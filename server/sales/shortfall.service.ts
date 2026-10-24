/*
 * Shortfalls (D-050): an explicitly recorded quantity of a sales order that
 * cannot currently be fulfilled as planned, with a reason. A shortfall is
 * never auto-created from a balance that is merely still in production;
 * someone records it. It is resolved when the goods are later shipped (the
 * open quantity of the order is checked against it), cancelled, or resolved
 * by hand. History is kept per record; nothing is overwritten.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { addDecimalStrings, compareDecimalStrings, normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import type { ShortfallInput, ShortfallResolve } from "./shortfall.validation";

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(): never {
  throw new AppError("Shortfall not found.", { code: "SHORTFALL_NOT_FOUND", status: 404 });
}

export async function createShortfall(input: ShortfallInput, actorId: string) {
  const order = await db.orm.public.SalesOrder.where({ id: input.salesOrderId }).first();
  if (!order) {
    throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 400 });
  }

  const line = input.salesOrderLineId ? await db.orm.public.SalesOrderLine.where({ id: input.salesOrderLineId }).first() : null;
  if (input.salesOrderLineId && (!line || line.salesOrderId !== input.salesOrderId)) {
    throw new AppError("The order line belongs to another sales order.", { code: "SHORTFALL_LINE_MISMATCH", status: 400 });
  }
  const productId = line?.productId ?? input.productId ?? null;
  const unit = line?.unit ?? (productId ? (await db.orm.public.Product.where({ id: productId }).first())?.unit ?? null : null);
  if (!unit) {
    throw new AppError("The unit of the shortfall quantity is not known.", { code: "SHORTFALL_UNIT_UNKNOWN", status: 400 });
  }

  const id = await db.transaction(async (tx) => {
    const shortfall = await tx.orm.public.Shortfall.create({
      salesOrderId: input.salesOrderId,
      salesOrderLineId: line?.id ?? null,
      productId,
      quantity: toPlainDecimalString(input.quantity),
      unit,
      reason: input.reason,
      notes: input.notes || null,
      status: "OPEN",
      createdBy: actorId,
    });
    await recordAuditEvent({
      actorId,
      action: "SHORTFALL_RECORDED",
      entityType: "Shortfall",
      entityId: shortfall.id,
      metadata: { salesOrderId: input.salesOrderId, quantity: input.quantity, unit, reason: input.reason },
    }, tx);
    return shortfall.id;
  });
  return getShortfall(id);
}

/*
 * Resolving by fulfilment: the quantity shipped since the shortfall was
 * recorded, above what the order's open shortfall records already claim,
 * can be applied to this record — up to its quantity.
 */
export async function resolveShortfall(id: string, input: ShortfallResolve, actorId: string) {
  if (!UUID.test(id)) notFound();
  const requested = input.quantity === undefined ? "" : dec(input.quantity);

  await db.transaction(async (tx) => {
    // One conditional UPDATE decides the outcome under the row's implicit
    // write lock: the amount is COALESCEd to "the rest" when not given, and
    // the WHERE clause refuses any request above what is left, so resolved
    // quantity can never pass the recorded quantity, whatever other requests
    // resolve concurrently — the loser simply matches no rows.
    const claimed = (await tx.query(db.raw.sql`
      update erp_shortfalls
        set "resolvedQuantity" = "resolvedQuantity" + amount,
            status = case when "resolvedQuantity" + amount = quantity then 'RESOLVED' else status end,
            "resolvedAt" = case when "resolvedQuantity" + amount = quantity then now() else "resolvedAt" end,
            "resolvedBy" = case when "resolvedQuantity" + amount = quantity then ${actorId}::uuid else "resolvedBy" end,
            "updatedAt" = now()
      from (select coalesce(nullif(${requested}::text, '')::numeric, quantity - "resolvedQuantity") as amount from erp_shortfalls where id = ${id}::uuid) as rest
      where erp_shortfalls.id = ${id}::uuid
        and erp_shortfalls.status = 'OPEN'
        and "quantity" - "resolvedQuantity" >= rest.amount
      returning amount::text as resolved,
                ("resolvedQuantity" + amount)::text as total,
                ("resolvedQuantity" + amount = quantity) as done
    `.returnsRow({ resolved: "pg/text@1", total: "pg/text@1", done: "pg/bool@1" }).build() as never)) as unknown as Array<{ resolved: string; total: string; done: boolean }>;
    if (!claimed.length) {
      const current = await tx.orm.public.Shortfall.where({ id }).first();
      if (!current) notFound();
      if (current.status !== "OPEN") {
        throw new AppError(`This shortfall is already ${current.status.toLowerCase()}.`, { code: "SHORTFALL_STATUS_CONFLICT", status: 409 });
      }
      throw new AppError(`Only ${subtractDecimalStrings(dec(current.quantity), dec(current.resolvedQuantity))} of this shortfall is left to resolve.`, {
        code: "SHORTFALL_OVER_RESOLVE",
        status: 409,
      });
    }
    const { resolved, total, done } = claimed[0];
    await recordAuditEvent({
      actorId,
      action: done ? "SHORTFALL_RESOLVED" : "SHORTFALL_PART_RESOLVED",
      entityType: "Shortfall",
      entityId: id,
      metadata: { quantity: resolved, total },
    }, tx);
  });
  return getShortfall(id);
}

export async function cancelShortfall(id: string, actorId: string) {
  if (!UUID.test(id)) notFound();
  await db.transaction(async (tx) => {
    const current = await tx.orm.public.Shortfall.where({ id }).first();
    if (!current) notFound();
    if (current.status !== "OPEN") {
      throw new AppError(`A ${current.status.toLowerCase()} shortfall cannot be cancelled.`, { code: "SHORTFALL_STATUS_CONFLICT", status: 409 });
    }
    await tx.orm.public.Shortfall.where({ id }).update({ status: "CANCELLED", resolvedAt: new Date().toISOString(), resolvedBy: actorId, updatedAt: new Date().toISOString() });
    await recordAuditEvent({ actorId, action: "SHORTFALL_CANCELLED", entityType: "Shortfall", entityId: id, metadata: { quantity: dec(current.quantity) } }, tx);
  });
  return getShortfall(id);
}

export async function getShortfall(id: string) {
  if (!UUID.test(id)) notFound();
  const row = await db.orm.public.Shortfall.where({ id }).first();
  if (!row) notFound();
  const [order, line, product, user] = await Promise.all([
    db.orm.public.SalesOrder.where({ id: row.salesOrderId }).first(),
    row.salesOrderLineId ? db.orm.public.SalesOrderLine.where({ id: row.salesOrderLineId }).first() : null,
    row.productId ? db.orm.public.Product.where({ id: row.productId }).first() : null,
    db.orm.public.User.where({ id: row.createdBy }).first(),
  ]);
  return {
    ...row,
    quantity: dec(row.quantity),
    resolvedQuantity: dec(row.resolvedQuantity),
    remainingQuantity: subtractDecimalStrings(dec(row.quantity), dec(row.resolvedQuantity)),
    orderNumber: order?.orderNumber ?? null,
    lineProduct: line?.productName ?? null,
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    createdByName: user?.name ?? null,
  };
}

export async function listShortfalls(filters: { salesOrderId?: string; status?: string; page: number; pageSize: number }) {
  let query = db.orm.public.Shortfall;
  if (filters.salesOrderId) query = query.where({ salesOrderId: filters.salesOrderId });
  if (filters.status) query = query.where({ status: filters.status });
  const result = await query.orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  return { shortfalls: page, page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}
