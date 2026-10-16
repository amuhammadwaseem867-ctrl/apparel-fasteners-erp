/*
 * Batch register (D-034). A batch records a quantity of one item from one
 * source (a production order, a purchase receipt, or opening stock), with
 * dates, status and traceability to inspections and NCRs.
 *
 * Batches are a register, not a stock dimension: stock balances are still
 * per item and location, and shipments do not name batches. The register
 * never lets batches from one source exceed what that source produced or
 * received.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { compareDecimalStrings, normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "./inventory.service";
import { quantityPrecisionError } from "./stock-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

export type BatchInput = { productId: string; sourceType: "PRODUCTION" | "PURCHASE" | "OPENING"; productionOrderId?: string; purchaseReceiptId?: string; supplierLotRef?: string; quantity: number; madeOn: string; expiresOn?: string; notes?: string };

export async function createBatch(input: BatchInput, actorId: string) {
  const product = await db.orm.public.Product.where({ id: input.productId }).first();
  if (!product) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 400 });
  const precision = quantityPrecisionError(input.quantity, product.unit);
  if (precision) throw new AppError(precision, { code: "QUANTITY_PRECISION", status: 400 });
  if (input.expiresOn && input.expiresOn < input.madeOn) throw new AppError("Expiry is before the batch date.", { code: "BATCH_DATES_INVALID", status: 400 });
  const quantity = toPlainDecimalString(input.quantity);

  const id = await db.transaction(async (tx) => {
    let available: string | null = null;
    if (input.sourceType === "PRODUCTION") {
      if (!input.productionOrderId) throw new AppError("Choose the production order.", { code: "BATCH_SOURCE_REQUIRED", status: 400 });
      const [order] = await rows<{ productId: string; quantity: string }>(tx, db.raw.sql`select "productId"::text as "productId", quantity::text as quantity from erp_production_orders where id = ${input.productionOrderId}::uuid for update`.returnsRow({ productId: "pg/text@1", quantity: "pg/text@1" }).build());
      if (!order) throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 400 });
      if (order.productId !== input.productId) throw new AppError("That production order makes a different item.", { code: "BATCH_SOURCE_MISMATCH", status: 409 });
      const [used] = await rows<{ total: string }>(tx, db.raw.sql`select coalesce(sum(quantity), 0)::text as total from erp_batches where "productionOrderId" = ${input.productionOrderId}::uuid and status <> 'REJECTED'`.returnsRow({ total: "pg/text@1" }).build());
      available = subtractDecimalStrings(dec(order.quantity), dec(used.total));
    } else if (input.sourceType === "PURCHASE") {
      if (!input.purchaseReceiptId) throw new AppError("Choose the goods receipt.", { code: "BATCH_SOURCE_REQUIRED", status: 400 });
      await tx.query(db.raw.sql`select id::text as id from erp_purchase_receipts where id = ${input.purchaseReceiptId}::uuid for update`.returnsRow({ id: "pg/text@1" }).build());
      const [received] = await rows<{ total: string; lines: string }>(tx, db.raw.sql`
        select coalesce(sum(r.quantity), 0)::text as total, count(*)::text as lines
        from erp_purchase_receipt_lines r join erp_purchase_order_lines l on l.id = r."purchaseOrderLineId"
        where r."receiptId" = ${input.purchaseReceiptId}::uuid and l."productId" = ${input.productId}::uuid
      `.returnsRow({ total: "pg/text@1", lines: "pg/text@1" }).build());
      if (received.lines === "0") throw new AppError("That goods receipt has no line for this item.", { code: "BATCH_SOURCE_MISMATCH", status: 409 });
      const [used] = await rows<{ total: string }>(tx, db.raw.sql`select coalesce(sum(quantity), 0)::text as total from erp_batches where "purchaseReceiptId" = ${input.purchaseReceiptId}::uuid and "productId" = ${input.productId}::uuid and status <> 'REJECTED'`.returnsRow({ total: "pg/text@1" }).build());
      available = subtractDecimalStrings(dec(received.total), dec(used.total));
    }
    if (available !== null && compareDecimalStrings(quantity, available) > 0) {
      throw new AppError(`Only ${available} ${product.unit} from this source is not yet in a batch.`, { code: "BATCH_EXCEEDS_SOURCE", status: 409, details: { available } });
    }
    const batchNumber = await allocateDocumentNumber(tx, "LOT");
    const batch = await tx.orm.public.Batch.create({
      batchNumber, productId: input.productId, sourceType: input.sourceType,
      productionOrderId: input.sourceType === "PRODUCTION" ? input.productionOrderId! : null,
      purchaseReceiptId: input.sourceType === "PURCHASE" ? input.purchaseReceiptId! : null,
      supplierLotRef: input.supplierLotRef || null, quantity, madeOn: input.madeOn, expiresOn: input.expiresOn || null, notes: input.notes || null, createdBy: actorId,
    });
    await recordAuditEvent({ actorId, action: "BATCH_CREATED", entityType: "Batch", entityId: batch.id, metadata: { batchNumber, quantity, sourceType: input.sourceType } }, tx);
    return batch.id;
  });
  return getBatch(id);
}

const ALLOWED: Record<string, string[]> = { ACTIVE: ["ON_HOLD", "RELEASED", "REJECTED", "CONSUMED"], ON_HOLD: ["RELEASED", "REJECTED"], RELEASED: ["ON_HOLD", "CONSUMED"], REJECTED: [], CONSUMED: [] };

export async function setBatchStatus(id: string, status: string, note: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Batch not found.", { code: "BATCH_NOT_FOUND", status: 404 });
  const from = Object.entries(ALLOWED).filter(([, to]) => to.includes(status)).map(([key]) => key);
  const updated = await rows<{ id: string }>(db.runtime(), db.raw.sql`
    update erp_batches set status = ${status}, notes = case when ${note} = '' then notes else coalesce(notes || E'\n', '') || ${note} end
    where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build());
  if (!updated.length) {
    const batch = await db.orm.public.Batch.where({ id }).first();
    if (!batch) throw new AppError("Batch not found.", { code: "BATCH_NOT_FOUND", status: 404 });
    throw new AppError(`A ${batch.status.toLowerCase().replace("_", " ")} batch cannot become ${status.toLowerCase().replace("_", " ")}.`, { code: "BATCH_STATUS_CONFLICT", status: 409 });
  }
  await recordAuditEvent({ actorId, action: "BATCH_STATUS_CHANGED", entityType: "Batch", entityId: id, metadata: { status, note: note || null } });
  return getBatch(id);
}

export async function getBatch(id: string) {
  if (!UUID.test(id)) throw new AppError("Batch not found.", { code: "BATCH_NOT_FOUND", status: 404 });
  const batch = await db.orm.public.Batch.where({ id }).first();
  if (!batch) throw new AppError("Batch not found.", { code: "BATCH_NOT_FOUND", status: 404 });
  const product = await db.orm.public.Product.where({ id: batch.productId }).first();
  const [trace] = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select coalesce((select "orderNumber" from erp_production_orders where id = nullif(${batch.productionOrderId ?? ""}, '')::uuid), '') as "orderNumber",
      coalesce((select r."receiptNumber" || '|' || o."poNumber" || '|' || o.id::text || '|' || s.name from erp_purchase_receipts r join erp_purchase_orders o on o.id = r."purchaseOrderId" join erp_suppliers s on s.id = o."supplierId"
        where r.id = nullif(${batch.purchaseReceiptId ?? ""}, '')::uuid), '') as receipt
  `.returnsRow({ orderNumber: "pg/text@1", receipt: "pg/text@1" }).build());
  const inspections = batch.productionOrderId ? await db.orm.public.QualityInspection.where({ productionOrderId: batch.productionOrderId }).all() : [];
  const ncrs = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select id::text as id, "ncrNumber", title, status from erp_ncrs
    where ("productionOrderId" = nullif(${batch.productionOrderId ?? ""}, '')::uuid) or ("productId" = ${batch.productId}::uuid and "createdAt"::date >= ${batch.madeOn}::date)
    order by "createdAt" desc limit 20
  `.returnsRow({ id: "pg/text@1", ncrNumber: "pg/text@1", title: "pg/text@1", status: "pg/text@1" }).build());
  const [receiptNumber, poNumber, purchaseOrderId, supplierName] = trace.receipt ? trace.receipt.split("|") : [];
  return {
    ...batch, quantity: dec(batch.quantity), sku: product?.sku ?? null, productName: product?.name ?? null, unit: product?.unit ?? null,
    expired: Boolean(batch.expiresOn && batch.expiresOn < new Date().toISOString().slice(0, 10)),
    trace: {
      productionOrderNumber: trace.orderNumber || null,
      receiptNumber: receiptNumber ?? null, poNumber: poNumber ?? null, purchaseOrderId: purchaseOrderId ?? null, supplierName: supplierName ?? null,
      inspections: inspections.map((row) => ({ id: row.id, inspectionNumber: row.inspectionNumber, inspectionType: row.inspectionType, status: row.status, passed: dec(row.passedQuantity), rejected: dec(row.rejectedQuantity) })),
      ncrs,
    },
  };
}

export async function listBatches(filters: { search: string; status: string; page: number; pageSize: number }) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select b.id::text as id, b."batchNumber", b."sourceType", b.quantity::text as quantity, b."madeOn", coalesce(b."expiresOn", '') as "expiresOn", b.status,
      coalesce(b."supplierLotRef", '') as "supplierLotRef", p.sku, p.name as "productName", p.unit,
      coalesce(o."orderNumber", r."receiptNumber", '') as source
    from erp_batches b join erp_products p on p.id = b."productId"
      left join erp_production_orders o on o.id = b."productionOrderId" left join erp_purchase_receipts r on r.id = b."purchaseReceiptId"
    where (${filters.status} = '' or b.status = ${filters.status} or (${filters.status} = 'EXPIRED' and b."expiresOn" < ${new Date().toISOString().slice(0, 10)} and b.status in ('ACTIVE', 'RELEASED', 'ON_HOLD')))
      and (${filters.search} = '' or b."batchNumber" ilike ${pattern} or p.sku ilike ${pattern} or b."supplierLotRef" ilike ${pattern} or o."orderNumber" ilike ${pattern} or r."receiptNumber" ilike ${pattern})
    order by b."createdAt" desc, b.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", batchNumber: "pg/text@1", sourceType: "pg/text@1", quantity: "pg/text@1", madeOn: "pg/text@1", expiresOn: "pg/text@1", status: "pg/text@1", supplierLotRef: "pg/text@1", sku: "pg/text@1", productName: "pg/text@1", unit: "pg/text@1", source: "pg/text@1" }).build());
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    batches: result.slice(0, filters.pageSize).map((row) => ({ ...row, quantity: dec(row.quantity), expiresOn: row.expiresOn || null, expired: Boolean(row.expiresOn && row.expiresOn < todayIso) })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

