/*
 * Packing lists (D-022).
 *
 * A DRAFT packing list records the packages for part of a production
 * order's output. Confirming it, in one transaction:
 *   - records the order's packing stage run (accepted = packed quantity),
 *     which is refused if more is packed than the order (D-048: QC does
 *     not have to come first);
 *   - posts a finished-goods receipt of the packed quantity into the
 *     chosen location, linked to the packing list.
 * DRAFT -> CONFIRMED and DRAFT -> CANCELLED are compare-and-set.
 * CONFIRMED -> SHIPPED is done by dispatch.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { addDecimalStrings, normalizeDecimalString, toPlainDecimalString, compareDecimalStrings } from "../core/utils/decimal";
import { allocateDocumentNumber, postStockDocumentInTransaction } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import { STAGES, stageQuantities, type StageTotals } from "../production/production-rules";
import { recordStageRunInTransaction } from "../production/production.service";
import type { PackingListInput, PackingQuery } from "./packing.validation";

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKING_STAGE = "packing";
const PACKING_SEQUENCE = STAGES.find((stage) => stage.key === PACKING_STAGE)!.sequence;

function notFound(): never {
  throw new AppError("Packing list not found.", { code: "PACKING_LIST_NOT_FOUND", status: 404 });
}

export async function packingAvailable(productionOrderId: string) {
  const order = await db.orm.public.ProductionOrder.where({ id: productionOrderId }).first();
  const stages = await db.orm.public.ProductionStage.where({ productionOrderId }).all();
  const totals: StageTotals[] = stages.map((stage) => ({
    sequence: stage.sequence,
    status: stage.status,
    processedQuantity: dec(stage.processedQuantity),
    acceptedQuantity: dec(stage.acceptedQuantity),
    rejectedQuantity: dec(stage.rejectedQuantity),
    wastageQuantity: dec(stage.wastageQuantity),
    reworkQuantity: dec(stage.reworkQuantity),
  }));
  return stageQuantities(totals, dec(order?.quantity), PACKING_SEQUENCE).available;
}

export async function createPackingList(input: PackingListInput, actorId: string) {
  const replay = await db.orm.public.PackingList.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getPackingList(replay.id);

  const order = await db.orm.public.ProductionOrder.where({ id: input.productionOrderId }).first();
  if (!order) {
    throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 400 });
  }
  if (!["RELEASED", "IN_PROGRESS"].includes(order.status)) {
    throw new AppError("Only released or in-progress production orders can be packed.", { code: "PRODUCTION_ORDER_NOT_OPEN", status: 409 });
  }
  const location = await db.orm.public.StorageLocation.where({ id: input.locationId }).first();
  if (!location) {
    throw new AppError("Storage location not found.", { code: "LOCATION_NOT_FOUND", status: 400 });
  }

  for (const [index, item] of input.packages.entries()) {
    const precision = quantityPrecisionError(item.quantity, order.unit);
    if (precision) {
      throw new AppError(`Package ${index + 1}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
    }
  }

  const total = input.packages.map((item) => toPlainDecimalString(item.quantity)).reduce((sum, value) => addDecimalStrings(sum, value), "0");
  const available = await packingAvailable(order.id);
  if (compareDecimalStrings(total, available) > 0) {
    throw new AppError(`Only ${available} is left to pack for ${order.orderNumber}.`, {
      code: "PACKING_EXCEEDS_AVAILABLE",
      status: 409,
    });
  }

  try {
    const id = await db.transaction(async (tx) => {
      const packingNumber = await allocateDocumentNumber(tx, "PKL");
      const list = await tx.orm.public.PackingList.create({
        packingNumber,
        productionOrderId: order.id,
        productId: order.productId,
        salesOrderId: order.salesOrderId,
        locationId: location.id,
        totalQuantity: total,
        // Bags / cartons in all rows; one row can be several of the same.
        packageCount: input.packages.reduce((sum, item) => sum + item.bags, 0),
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      for (const [index, item] of input.packages.entries()) {
        await tx.orm.public.PackingPackage.create({
          packingListId: list.id,
          packageNo: index + 1,
          packageType: item.packageType,
          quantity: toPlainDecimalString(item.quantity),
          netWeight: item.netWeight === undefined ? null : toPlainDecimalString(item.netWeight),
          grossWeight: item.grossWeight === undefined ? null : toPlainDecimalString(item.grossWeight),
          dimensions: item.dimensions || null,
          marks: item.marks || null,
          description: item.description || null,
          size: item.size || null,
          bags: item.bags,
        });
      }
      await recordAuditEvent({
        actorId,
        action: "PACKING_LIST_CREATED",
        entityType: "PackingList",
        entityId: list.id,
        metadata: { packingNumber, productionOrderId: order.id, total },
      }, tx);
      if (input.confirm) await applyPackingAction(tx, list.id, "confirm", actorId);
      return list.id;
    });
    return getPackingList(id);
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("idempotencyKey")) {
      const original = await db.orm.public.PackingList.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getPackingList(original.id);
    }
    throw error;
  }
}

export async function changePackingList(id: string, action: "confirm" | "cancel", actorId: string) {
  if (!UUID.test(id)) notFound();
  await db.transaction((tx) => applyPackingAction(tx, id, action, actorId));
  return getPackingList(id);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyPackingAction(tx: Tx, id: string, action: "confirm" | "cancel", actorId: string) {
  {
    const status = action === "confirm" ? "CONFIRMED" : "CANCELLED";
    const claimed = (await tx.query(db.raw.sql`
      update erp_packing_lists
        set status = ${status},
            "confirmedBy" = case when ${status} = 'CONFIRMED' then ${actorId}::uuid else null end,
            "confirmedAt" = case when ${status} = 'CONFIRMED' then now() else null end
      where id = ${id}::uuid and status = 'DRAFT'
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build() as never)) as unknown as Array<{ id: string }>;

    if (!claimed.length) {
      const existing = await tx.orm.public.PackingList.where({ id }).first();
      if (!existing) notFound();
      throw new AppError(`This packing list is already ${existing.status.toLowerCase()}.`, { code: "PACKING_STATUS_CONFLICT", status: 409 });
    }

    const list = (await tx.orm.public.PackingList.where({ id }).first())!;
    const total = dec(list.totalQuantity);

    if (action === "confirm") {
      await recordStageRunInTransaction(tx, list.productionOrderId, PACKING_STAGE, {
        idempotencyKey: `pkl-${id}`,
        inputQuantity: Number(total),
        acceptedQuantity: Number(total),
        rejectedQuantity: 0,
        wastageQuantity: 0,
        reworkQuantity: 0,
        operatorName: "",
        workstation: "",
        remarks: `Packing list ${list.packingNumber} (${list.packageCount} packages)`,
      }, actorId, "packing");

      await postStockDocumentInTransaction(tx, {
        documentType: "FG_RECEIPT",
        idempotencyKey: `pkl-fg-${id}`,
        reference: list.packingNumber,
        reason: "",
        notes: "",
        sourceType: "PackingList",
        sourceId: id,
        lines: [{ productId: list.productId, locationId: list.locationId, quantity: Number(total) }],
      }, actorId);
    }

    await recordAuditEvent({
      actorId,
      action: action === "confirm" ? "PACKING_LIST_CONFIRMED" : "PACKING_LIST_CANCELLED",
      entityType: "PackingList",
      entityId: id,
      metadata: { packingNumber: list.packingNumber, total },
    }, tx);
  }
}

async function lookups(rows: Array<{ productId: string; productionOrderId: string; salesOrderId: string | null; locationId: string; shipmentId: string | null }>) {
  const unique = (values: Array<string | null>) => [...new Set(values.filter(Boolean) as string[])];
  const productIds = unique(rows.map((row) => row.productId));
  const orderIds = unique(rows.map((row) => row.productionOrderId));
  const salesIds = unique(rows.map((row) => row.salesOrderId));
  const locationIds = unique(rows.map((row) => row.locationId));
  const shipmentIds = unique(rows.map((row) => row.shipmentId));
  const [products, orders, sales, locations, shipments] = await Promise.all([
    productIds.length ? db.orm.public.Product.where((item) => item.id.in(productIds)).all() : [],
    orderIds.length ? db.orm.public.ProductionOrder.where((item) => item.id.in(orderIds)).all() : [],
    salesIds.length ? db.orm.public.SalesOrder.where((item) => item.id.in(salesIds)).all() : [],
    locationIds.length ? db.orm.public.StorageLocation.where((item) => item.id.in(locationIds)).all() : [],
    shipmentIds.length ? db.orm.public.Shipment.where((item) => item.id.in(shipmentIds)).all() : [],
  ]);
  const warehouses = locations.length
    ? await db.orm.public.Warehouse.where((item) => item.id.in(unique(locations.map((location) => location.warehouseId)))).all()
    : [];
  return { products, orders, sales, locations, warehouses, shipments };
}

function present(row: Record<string, unknown> & { productId: string; productionOrderId: string; salesOrderId: string | null; locationId: string; shipmentId: string | null }, data: Awaited<ReturnType<typeof lookups>>) {
  const product = data.products.find((item) => item.id === row.productId);
  const location = data.locations.find((item) => item.id === row.locationId);
  return {
    ...row,
    totalQuantity: dec(row.totalQuantity),
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    unit: product?.unit ?? null,
    orderNumber: data.orders.find((item) => item.id === row.productionOrderId)?.orderNumber ?? null,
    salesOrderNumber: data.sales.find((item) => item.id === row.salesOrderId)?.orderNumber ?? null,
    locationLabel: location ? `${data.warehouses.find((item) => item.id === location.warehouseId)?.code ?? "?"}/${location.code}` : null,
    shipmentNumber: data.shipments.find((item) => item.id === row.shipmentId)?.shipmentNumber ?? null,
  };
}

export async function getPackingList(id: string) {
  if (!UUID.test(id)) notFound();
  const row = await db.orm.public.PackingList.where({ id }).first();
  if (!row) notFound();
  const packages = await db.orm.public.PackingPackage.where({ packingListId: id }).orderBy((item) => item.packageNo.asc()).all();
  const documents = await db.orm.public.StockDocument.where({ sourceType: "PackingList", sourceId: id }).all();
  const data = await lookups([row]);
  // Dispatch record (D-050): the shipments that took part of this list.
  const dispatchLines = await db.runtime().query(db.raw.sql`
    select l.id::text as id, l.quantity::text as quantity, l."lineNo",
           s.id::text as "shipmentId", s."shipmentNumber", s.status, s."dispatchedAt", s."deliveredAt"
    from erp_shipment_lines l join erp_shipments s on s.id = l."shipmentId"
    where l."packingListId" = ${id}::uuid
    order by s."createdAt", l."lineNo"
  `.returnsRow({ id: "pg/text@1", quantity: "pg/text@1", lineNo: "pg/int4@1", shipmentId: "pg/text@1", shipmentNumber: "pg/text@1", status: "pg/text@1", dispatchedAt: "pg/timestamptz-string@1", deliveredAt: "pg/timestamptz-string@1" }).build() as never) as unknown as Array<{ id: string; quantity: string; lineNo: number; shipmentId: string; shipmentNumber: string; status: string; dispatchedAt: string | null; deliveredAt: string | null }>;
  // PO # and customer for the AF7 packing list.
  const sale = data.sales.find((item) => item.id === row.salesOrderId);
  const customer = sale ? await db.orm.public.Customer.where({ id: sale.customerId }).first() : null;
  return {
    ...present(row as never, data),
    size: data.products.find((item) => item.id === row.productId)?.size ?? null,
    customerPo: sale?.customerPo ?? null,
    customerName: customer?.name ?? null,
    packages: packages.map((item) => ({
      ...item,
      quantity: dec(item.quantity),
      netWeight: item.netWeight === null ? null : dec(item.netWeight),
      grossWeight: item.grossWeight === null ? null : dec(item.grossWeight),
    })),
    stockDocuments: documents.map((document) => ({ id: document.id, documentNumber: document.documentNumber, documentType: document.documentType })),
    dispatches: dispatchLines.map((line) => ({ ...line, quantity: dec(line.quantity) })),
    dispatchedQuantity: dispatchLines
      .filter((line) => line.status === "DISPATCHED" || line.status === "DELIVERED")
      .map((line) => line.quantity)
      .reduce((sum, value) => addDecimalStrings(sum, value), "0"),
    history: await packingHistory(row),
  };
}

/*
 * What happened to a packing list, oldest first: made, passed (confirmed)
 * or cancelled, from the audit log; shipped and delivered, from every
 * shipment line that took part of it (D-050), so a partially shipped list
 * shows each shipment. A fully shipped list keeps its singular shipmentId
 * entry; the line-based query returns that same shipment once, so nothing
 * is duplicated.
 */
async function packingHistory(row: { id: string; shipmentId: string | null }) {
  const events = await db.orm.public.AuditLog.where({ entityType: "PackingList", entityId: row.id }).orderBy((item) => item.createdAt.asc()).all();
  const dispatches = (await db.runtime().query(db.raw.sql`
    select distinct on (s.id) s.id::text as "shipmentId", s."shipmentNumber", s.status,
           s."dispatchedAt", s."dispatchedBy", s."deliveredAt", s."deliveredBy", s."receivedBy"
    from erp_shipment_lines l join erp_shipments s on s.id = l."shipmentId"
    where l."packingListId" = ${row.id}::uuid
    order by s.id, s."createdAt"
  `.returnsRow({ shipmentId: "pg/text@1", shipmentNumber: "pg/text@1", status: "pg/text@1", dispatchedAt: "pg/timestamptz-string@1", dispatchedBy: "pg/text@1", deliveredAt: "pg/timestamptz-string@1", deliveredBy: "pg/text@1", receivedBy: "pg/text@1" }).build() as never)) as unknown as Array<{
    shipmentId: string; shipmentNumber: string; status: string;
    dispatchedAt: string | null; dispatchedBy: string | null;
    deliveredAt: string | null; deliveredBy: string | null; receivedBy: string | null;
  }>;
  const userIds = [
    ...new Set([
      ...events.map((item) => item.actorId),
      ...dispatches.flatMap((item) => [item.dispatchedBy, item.deliveredBy]),
      row.shipmentId ? dispatches.find((item) => item.shipmentId === row.shipmentId)?.deliveredBy : undefined,
    ].filter(Boolean) as string[]),
  ];
  const users = userIds.length ? await db.orm.public.User.where((item) => item.id.in(userIds)).select("id", "name").all() : [];
  const name = (id: string | null | undefined) => users.find((user) => user.id === id)?.name ?? null;
  const LABELS: Record<string, string> = {
    PACKING_LIST_CREATED: "Packing list made",
    PACKING_LIST_CONFIRMED: "Packing passed: stock received",
    PACKING_LIST_CANCELLED: "Cancelled",
  };
  const history = events
    .filter((item) => LABELS[item.action])
    .map((item) => ({ event: LABELS[item.action], at: item.createdAt, by: name(item.actorId), reference: null as string | null }));
  for (const shipment of dispatches) {
    if (shipment.dispatchedAt) history.push({ event: "Shipped", at: shipment.dispatchedAt, by: name(shipment.dispatchedBy), reference: shipment.shipmentNumber });
    if (shipment.deliveredAt) history.push({ event: "Delivered", at: shipment.deliveredAt, by: name(shipment.deliveredBy), reference: shipment.receivedBy ? `received by ${shipment.receivedBy}` : shipment.shipmentNumber });
  }
  return history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export async function listPackingLists(filters: PackingQuery) {
  let query = db.orm.public.PackingList;
  if (filters.status === "OPEN") query = query.where((row) => row.status.in(["DRAFT", "CONFIRMED"]));
  else if (filters.status) query = query.where({ status: filters.status });
  if (filters.productionOrderId) query = query.where({ productionOrderId: filters.productionOrderId });
  if (filters.salesOrderId) query = query.where({ salesOrderId: filters.salesOrderId });
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const products = await db.orm.public.Product.where((product) => or(product.sku.ilike(pattern), product.name.ilike(pattern))).select("id").all();
    const productIds = products.map((product) => product.id);
    query = query.where((row) => (productIds.length
      ? or(row.packingNumber.ilike(pattern), row.productId.in(productIds))
      : row.packingNumber.ilike(pattern)));
  }
  const result = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const data = await lookups(page);
  return {
    packingLists: page.map((row) => present(row as never, data)),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/*
 * One packing list for a whole order (D-048): every product's packed rows
 * (drafts and passed lists; cancelled ones left out), under the order's own
 * number, PO and customer, with the totals of the order.
 */
export async function getOrderPackingList(salesOrderId: string) {
  if (!UUID.test(salesOrderId)) notFound();
  const sale = await db.orm.public.SalesOrder.where({ id: salesOrderId }).first();
  if (!sale) notFound();
  const lists = (await db.orm.public.PackingList.where({ salesOrderId }).orderBy((row) => row.createdAt.asc()).all())
    .filter((list) => list.status !== "CANCELLED");
  const detailed = await Promise.all(lists.map((list) => getPackingList(list.id)));
  const customer = await db.orm.public.Customer.where({ id: sale.customerId }).first();
  const rows = detailed.flatMap((list, index) => list.packages.map((item) => ({
    ...item,
    description: item.description || list.productName,
    size: item.size || list.size,
    unit: list.unit,
    packingNumber: lists[index].packingNumber,
    status: lists[index].status,
  })));
  return {
    salesOrderId: sale.id,
    orderNumber: sale.orderNumber,
    customerPo: sale.customerPo ?? null,
    customerName: customer?.name ?? null,
    date: lists.at(-1)?.createdAt ?? null,
    drafts: lists.filter((list) => list.status === "DRAFT").map((list) => list.packingNumber),
    rows: rows.map((row, index) => ({ ...row, rowNo: index + 1 })),
  };
}
