/*
 * Procurement (D-029): suppliers, requisitions, RFQs, purchase orders and
 * goods receipts.
 *
 * Requisition  DRAFT -> SUBMITTED -> APPROVED | REJECTED; -> ORDERED when a
 *              PO is raised from it; drafts/submitted can be cancelled.
 *              Lines may come from CONFIRMED MRP BUY planned orders (once).
 * RFQ          OPEN (quotes per supplier) -> AWARDED (creates a draft PO at
 *              the quoted prices) | CANCELLED.
 * PO           DRAFT -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED; drafts
 *              and approved POs with nothing received can be CANCELLED;
 *              partly received POs can be CLOSED short with a reason.
 * Receipt      locks the PO, never receives more than ordered, posts a
 *              GOODS_RECEIPT (and optionally a QC_HOLD) in the same
 *              transaction.
 * Status changes are compare-and-set; amounts are exact cents.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { addDecimalStrings, compareDecimalStrings, decimalSign, normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { lineAmounts, money, sumAmounts } from "../finance/finance-rules";
import { allocateDocumentNumber, postStockDocumentInTransaction, type Tx } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import type { ListQuery, PurchaseOrderInput, QuoteInput, ReceiptInput, RequisitionInput, RfqInput, SupplierInput, SupplierUpdate } from "./procurement.validation";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
export const cash = (value: unknown) => money(String(value ?? "0"));

export function notFound(what: string, code: string): never {
  throw new AppError(`${what} not found.`, { code, status: 404 });
}

export function isUnique(error: unknown, fragment = "") {
  const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
  return sqlError?.sqlState === "23505" && (!fragment || Boolean(sqlError.constraint?.includes(fragment)));
}

export async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

/* Moves `table`.status from one of `from` to `to` for `id`; false when it was not in `from`. */
async function transition(tx: Tx, table: string, id: string, from: string[], to: string) {
  const sql = {
    erp_purchase_requisitions: db.raw.sql`update erp_purchase_requisitions set status = ${to} where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id`,
    erp_rfqs: db.raw.sql`update erp_rfqs set status = ${to} where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id`,
    erp_purchase_orders: db.raw.sql`update erp_purchase_orders set status = ${to} where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id`,
  }[table];
  if (!sql) throw new Error(`Unknown table ${table}`);
  return (await rows(tx, sql.returnsRow({ id: "pg/text@1" }).build())).length > 0;
}

async function productsById(ids: string[]) {
  const unique = [...new Set(ids)];
  const products = unique.length ? await db.orm.public.Product.where((product) => product.id.in(unique)).all() : [];
  return new Map(products.map((product) => [product.id, product]));
}

async function requireProducts(lines: Array<{ productId: string; quantity: number }>) {
  const products = await productsById(lines.map((line) => line.productId));
  for (const [index, line] of lines.entries()) {
    const product = products.get(line.productId);
    if (!product) throw new AppError(`Line ${index + 1}: item not found.`, { code: "PRODUCT_NOT_FOUND", status: 400 });
    if (product.status === "ARCHIVED") throw new AppError(`Line ${index + 1}: ${product.sku} is archived.`, { code: "PRODUCT_ARCHIVED", status: 409 });
    const precision = quantityPrecisionError(line.quantity, product.unit);
    if (precision) throw new AppError(`Line ${index + 1}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
  }
  return products;
}

/* ------------------------------------------------------------------ */
/* Suppliers                                                           */
/* ------------------------------------------------------------------ */

export async function listSuppliers(filters: ListQuery) {
  let query = db.orm.public.Supplier;
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((row) => or(row.name.ilike(pattern), row.code.ilike(pattern), row.contactName.ilike(pattern)));
  }
  const result = await query.orderBy((row) => row.name.asc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize + 1).all();
  return { suppliers: result.slice(0, filters.pageSize), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

export async function getSupplier(id: string) {
  if (!UUID.test(id)) notFound("Supplier", "SUPPLIER_NOT_FOUND");
  const supplier = await db.orm.public.Supplier.where({ id }).first();
  if (!supplier) notFound("Supplier", "SUPPLIER_NOT_FOUND");
  return supplier;
}

const supplierFields = (input: SupplierInput | SupplierUpdate) => ({
  name: input.name,
  contactName: input.contactName || null,
  phone: input.phone || null,
  email: input.email || null,
  address: input.address || null,
  taxRegistration: input.taxRegistration || null,
  paymentTermsDays: input.paymentTermsDays,
  notes: input.notes || null,
});

export async function createSupplier(input: SupplierInput, actorId: string) {
  try {
    const supplier = await db.orm.public.Supplier.create({ code: input.code, ...supplierFields(input) });
    await recordAuditEvent({ actorId, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: supplier.id, metadata: { code: input.code } });
    return supplier;
  } catch (error) {
    if (isUnique(error)) throw new AppError("A supplier with that code already exists.", { code: "SUPPLIER_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateSupplier(id: string, input: SupplierUpdate, actorId: string) {
  await getSupplier(id);
  await db.orm.public.Supplier.where({ id }).update({ ...supplierFields(input), status: input.status, updatedAt: new Date().toISOString() });
  await recordAuditEvent({ actorId, action: "SUPPLIER_UPDATED", entityType: "Supplier", entityId: id, metadata: { status: input.status } });
  return getSupplier(id);
}

/* ------------------------------------------------------------------ */
/* Requisitions                                                        */
/* ------------------------------------------------------------------ */

export async function createRequisition(input: RequisitionInput, actorId: string) {
  const replay = await db.orm.public.PurchaseRequisition.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getRequisition(replay.id);

  const lines: Array<{ productId: string; quantity: string; plannedOrderId: string | null; notes: string | null }> = input.lines.map((line) => ({
    productId: line.productId, quantity: toPlainDecimalString(line.quantity), plannedOrderId: null, notes: line.notes || null,
  }));
  await requireProducts(input.lines);
  for (const plannedOrderId of input.plannedOrderIds) {
    const planned = await db.orm.public.MrpPlannedOrder.where({ id: plannedOrderId }).first();
    if (!planned || planned.status !== "CONFIRMED" || planned.orderType !== "BUY") {
      throw new AppError("Only confirmed BUY planned orders can be requisitioned.", { code: "PLANNED_ORDER_NOT_CONVERTIBLE", status: 409 });
    }
    lines.push({ productId: planned.productId, quantity: dec(planned.quantity), plannedOrderId, notes: `From MRP planned order (due ${planned.dueDate ?? "—"})` });
  }

  try {
    const id = await db.transaction(async (tx) => {
      const requisitionNumber = await allocateDocumentNumber(tx, "PR");
      const requisition = await tx.orm.public.PurchaseRequisition.create({
        requisitionNumber, neededBy: input.neededBy || null, notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      for (const [index, line] of lines.entries()) {
        await tx.orm.public.PurchaseRequisitionLine.create({ requisitionId: requisition.id, lineNo: index + 1, ...line });
      }
      await recordAuditEvent({ actorId, action: "REQUISITION_CREATED", entityType: "PurchaseRequisition", entityId: requisition.id, metadata: { requisitionNumber, lines: lines.length } }, tx);
      return requisition.id;
    });
    return getRequisition(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.PurchaseRequisition.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getRequisition(original.id);
    }
    if (isUnique(error, "plannedOrderId")) {
      throw new AppError("A planned order on this requisition has already been requisitioned.", { code: "PLANNED_ORDER_ALREADY_CONVERTED", status: 409 });
    }
    throw error;
  }
}

export async function changeRequisition(id: string, action: "submit" | "approve" | "reject" | "cancel", note: string, actorId: string) {
  if (!UUID.test(id)) notFound("Requisition", "REQUISITION_NOT_FOUND");
  const rule = { submit: [["DRAFT"], "SUBMITTED"], approve: [["SUBMITTED"], "APPROVED"], reject: [["SUBMITTED"], "REJECTED"], cancel: [["DRAFT", "SUBMITTED"], "CANCELLED"] }[action] as [string[], string];
  await db.transaction(async (tx) => {
    const requisition = await tx.orm.public.PurchaseRequisition.where({ id }).first();
    if (!requisition) notFound("Requisition", "REQUISITION_NOT_FOUND");
    if (!(await transition(tx, "erp_purchase_requisitions", id, rule[0], rule[1]))) {
      throw new AppError(`A ${requisition.status.toLowerCase()} requisition cannot be ${action === "submit" ? "submitted" : `${action}${action.endsWith("e") ? "d" : "ed"}`}.`, { code: "REQUISITION_STATUS_CONFLICT", status: 409 });
    }
    const now = new Date().toISOString();
    await tx.orm.public.PurchaseRequisition.where({ id }).update(action === "submit"
      ? { submittedAt: now }
      : { decidedBy: actorId, decidedAt: now, decisionNote: note || null });
    await recordAuditEvent({ actorId, action: `REQUISITION_${rule[1]}`, entityType: "PurchaseRequisition", entityId: id, metadata: { note: note || null } }, tx);
  });
  return getRequisition(id);
}

export async function getRequisition(id: string) {
  if (!UUID.test(id)) notFound("Requisition", "REQUISITION_NOT_FOUND");
  const requisition = await db.orm.public.PurchaseRequisition.where({ id }).first();
  if (!requisition) notFound("Requisition", "REQUISITION_NOT_FOUND");
  const lines = await db.orm.public.PurchaseRequisitionLine.where({ requisitionId: id }).orderBy((line) => line.lineNo.asc()).all();
  const products = await productsById(lines.map((line) => line.productId));
  const orders = await db.orm.public.PurchaseOrder.where({ requisitionId: id }).all();
  return {
    ...requisition,
    lines: lines.map((line) => ({ ...line, quantity: dec(line.quantity), sku: products.get(line.productId)?.sku ?? null, productName: products.get(line.productId)?.name ?? null, unit: products.get(line.productId)?.unit ?? null })),
    purchaseOrders: orders.map((order) => ({ id: order.id, poNumber: order.poNumber, status: order.status })),
  };
}

export async function listRequisitions(filters: ListQuery) {
  let query = db.orm.public.PurchaseRequisition;
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.search) query = query.where((row) => row.requisitionNumber.ilike(`%${filters.search}%`));
  const result = await query.orderBy((row) => row.createdAt.desc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize + 1).all();
  const page = result.slice(0, filters.pageSize);
  const lines = page.length ? await db.orm.public.PurchaseRequisitionLine.where((line) => line.requisitionId.in(page.map((row) => row.id))).select("requisitionId").all() : [];
  return {
    requisitions: page.map((row) => ({ ...row, lineCount: lines.filter((line) => line.requisitionId === row.id).length })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* RFQs                                                                */
/* ------------------------------------------------------------------ */

export async function createRfq(input: RfqInput, actorId: string) {
  const replay = await db.orm.public.Rfq.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getRfq(replay.id);
  let lines = input.lines.map((line) => ({ productId: line.productId, quantity: toPlainDecimalString(line.quantity) }));
  if (input.requisitionId) {
    const requisition = await getRequisition(input.requisitionId);
    if (requisition.status !== "APPROVED") throw new AppError("Only approved requisitions can go out for quotation.", { code: "REQUISITION_NOT_APPROVED", status: 409 });
    if (!lines.length) lines = requisition.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
  } else {
    await requireProducts(input.lines);
  }
  try {
    const id = await db.transaction(async (tx) => {
      const rfqNumber = await allocateDocumentNumber(tx, "RFQ");
      const rfq = await tx.orm.public.Rfq.create({
        rfqNumber, requisitionId: input.requisitionId ?? null, responseDue: input.responseDue || null, notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      for (const [index, line] of lines.entries()) await tx.orm.public.RfqLine.create({ rfqId: rfq.id, lineNo: index + 1, ...line });
      await recordAuditEvent({ actorId, action: "RFQ_CREATED", entityType: "Rfq", entityId: rfq.id, metadata: { rfqNumber } }, tx);
      return rfq.id;
    });
    return getRfq(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.Rfq.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getRfq(original.id);
    }
    throw error;
  }
}

/* Records (or replaces, while the RFQ is open) one supplier's quote. */
export async function saveQuote(rfqId: string, input: QuoteInput, actorId: string) {
  if (!UUID.test(rfqId)) notFound("RFQ", "RFQ_NOT_FOUND");
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_rfqs where id = ${rfqId}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!locked) notFound("RFQ", "RFQ_NOT_FOUND");
    if (locked.status !== "OPEN") throw new AppError("Quotes can only be recorded on open RFQs.", { code: "RFQ_NOT_OPEN", status: 409 });
    const supplier = await tx.orm.public.Supplier.where({ id: input.supplierId }).first();
    if (!supplier || supplier.status !== "ACTIVE") throw new AppError("Choose an active supplier.", { code: "SUPPLIER_NOT_ACTIVE", status: 409 });
    const lines = await tx.orm.public.RfqLine.where({ rfqId }).all();
    if (input.prices.length !== lines.length || !lines.every((line) => input.prices.some((item) => item.rfqLineId === line.id))) {
      throw new AppError("Give a price for every RFQ line.", { code: "QUOTE_INCOMPLETE", status: 400 });
    }
    const totals = sumAmounts(lines.map((line) => lineAmounts(dec(line.quantity), toPlainDecimalString(input.prices.find((item) => item.rfqLineId === line.id)!.unitPrice), 0, input.taxPercent)));
    const existing = await tx.orm.public.RfqQuote.where({ rfqId, supplierId: input.supplierId }).first();
    if (existing) {
      await tx.orm.public.RfqQuoteLine.where({ quoteId: existing.id }).deleteAll();
      await tx.orm.public.RfqQuote.where({ id: existing.id }).deleteAll();
    }
    const quote = await tx.orm.public.RfqQuote.create({
      rfqId, supplierId: input.supplierId, quoteRef: input.quoteRef || null, validUntil: input.validUntil || null, leadTimeDays: input.leadTimeDays ?? null,
      taxPercent: input.taxPercent, totalAmount: totals.lineTotal, notes: input.notes || null, createdBy: actorId,
    });
    for (const item of input.prices) await tx.orm.public.RfqQuoteLine.create({ quoteId: quote.id, rfqLineId: item.rfqLineId, unitPrice: toPlainDecimalString(item.unitPrice) });
    await recordAuditEvent({ actorId, action: "RFQ_QUOTE_RECORDED", entityType: "Rfq", entityId: rfqId, metadata: { supplierId: input.supplierId, total: totals.lineTotal } }, tx);
  });
  return getRfq(rfqId);
}

/* Awards one quote: the RFQ closes and a DRAFT PO is raised at the quoted prices. */
export async function awardRfq(rfqId: string, quoteId: string, idempotencyKey: string, actorId: string) {
  if (!UUID.test(rfqId)) notFound("RFQ", "RFQ_NOT_FOUND");
  const poId = await db.transaction(async (tx) => {
    const rfq = await tx.orm.public.Rfq.where({ id: rfqId }).first();
    if (!rfq) notFound("RFQ", "RFQ_NOT_FOUND");
    const quote = await tx.orm.public.RfqQuote.where({ id: quoteId, rfqId }).first();
    if (!quote) throw new AppError("That quote is not on this RFQ.", { code: "QUOTE_NOT_FOUND", status: 400 });
    if (!(await transition(tx, "erp_rfqs", rfqId, ["OPEN"], "AWARDED"))) throw new AppError("This RFQ is no longer open.", { code: "RFQ_NOT_OPEN", status: 409 });
    await tx.orm.public.Rfq.where({ id: rfqId }).update({ awardedQuoteId: quoteId, closedAt: new Date().toISOString() });
    const lines = await tx.orm.public.RfqLine.where({ rfqId }).orderBy((line) => line.lineNo.asc()).all();
    const prices = await tx.orm.public.RfqQuoteLine.where({ quoteId }).all();
    const today = new Date().toISOString().slice(0, 10);
    const expected = quote.leadTimeDays === null ? null : new Date(Date.now() + quote.leadTimeDays * 86400000).toISOString().slice(0, 10);
    const id = await insertPurchaseOrder(tx, {
      supplierId: quote.supplierId, orderDate: today, expectedDate: expected, requisitionId: rfq.requisitionId, rfqId, notes: `Awarded from ${rfq.rfqNumber}${quote.quoteRef ? ` (quote ${quote.quoteRef})` : ""}`,
      idempotencyKey,
      lines: lines.map((line) => ({ productId: line.productId, quantity: dec(line.quantity), unitPrice: dec(prices.find((price) => price.rfqLineId === line.id)!.unitPrice), discountPercent: 0, taxPercent: quote.taxPercent, requisitionLineId: null })),
    }, actorId);
    if (rfq.requisitionId) await transition(tx, "erp_purchase_requisitions", rfq.requisitionId, ["APPROVED"], "ORDERED");
    await recordAuditEvent({ actorId, action: "RFQ_AWARDED", entityType: "Rfq", entityId: rfqId, metadata: { quoteId, purchaseOrderId: id } }, tx);
    return id;
  });
  return getPurchaseOrder(poId);
}

export async function cancelRfq(rfqId: string, actorId: string) {
  if (!UUID.test(rfqId)) notFound("RFQ", "RFQ_NOT_FOUND");
  await db.transaction(async (tx) => {
    if (!(await transition(tx, "erp_rfqs", rfqId, ["OPEN"], "CANCELLED"))) throw new AppError("Only open RFQs can be cancelled.", { code: "RFQ_NOT_OPEN", status: 409 });
    await tx.orm.public.Rfq.where({ id: rfqId }).update({ closedAt: new Date().toISOString() });
    await recordAuditEvent({ actorId, action: "RFQ_CANCELLED", entityType: "Rfq", entityId: rfqId }, tx);
  });
  return getRfq(rfqId);
}

export async function getRfq(id: string) {
  if (!UUID.test(id)) notFound("RFQ", "RFQ_NOT_FOUND");
  const rfq = await db.orm.public.Rfq.where({ id }).first();
  if (!rfq) notFound("RFQ", "RFQ_NOT_FOUND");
  const lines = await db.orm.public.RfqLine.where({ rfqId: id }).orderBy((line) => line.lineNo.asc()).all();
  const quotes = await db.orm.public.RfqQuote.where({ rfqId: id }).all();
  const quoteLines = quotes.length ? await db.orm.public.RfqQuoteLine.where((line) => line.quoteId.in(quotes.map((quote) => quote.id))).all() : [];
  const suppliers = quotes.length ? await db.orm.public.Supplier.where((row) => row.id.in(quotes.map((quote) => quote.supplierId))).all() : [];
  const products = await productsById(lines.map((line) => line.productId));
  const order = await db.orm.public.PurchaseOrder.where({ rfqId: id }).first();
  return {
    ...rfq,
    purchaseOrderId: order?.id ?? null,
    poNumber: order?.poNumber ?? null,
    lines: lines.map((line) => ({ ...line, quantity: dec(line.quantity), sku: products.get(line.productId)?.sku ?? null, productName: products.get(line.productId)?.name ?? null, unit: products.get(line.productId)?.unit ?? null })),
    quotes: quotes
      .map((quote) => ({
        ...quote,
        totalAmount: cash(quote.totalAmount),
        supplierName: suppliers.find((row) => row.id === quote.supplierId)?.name ?? null,
        prices: quoteLines.filter((line) => line.quoteId === quote.id).map((line) => ({ rfqLineId: line.rfqLineId, unitPrice: dec(line.unitPrice) })),
      }))
      .sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount)),
  };
}

export async function listRfqs(filters: ListQuery) {
  let query = db.orm.public.Rfq;
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.search) query = query.where((row) => row.rfqNumber.ilike(`%${filters.search}%`));
  const result = await query.orderBy((row) => row.createdAt.desc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize + 1).all();
  const page = result.slice(0, filters.pageSize);
  const quotes = page.length ? await db.orm.public.RfqQuote.where((quote) => quote.rfqId.in(page.map((row) => row.id))).select("rfqId").all() : [];
  return { rfqs: page.map((row) => ({ ...row, quoteCount: quotes.filter((quote) => quote.rfqId === row.id).length })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

/* ------------------------------------------------------------------ */
/* Purchase orders                                                     */
/* ------------------------------------------------------------------ */

type PoDraft = {
  supplierId: string;
  orderDate: string;
  expectedDate: string | null;
  requisitionId: string | null;
  rfqId: string | null;
  notes: string | null;
  idempotencyKey: string;
  lines: Array<{ productId: string; quantity: string; unitPrice: string; discountPercent: number; taxPercent: number; requisitionLineId: string | null }>;
};

async function insertPurchaseOrder(tx: Tx, draft: PoDraft, actorId: string) {
  const supplier = await tx.orm.public.Supplier.where({ id: draft.supplierId }).first();
  if (!supplier || supplier.status !== "ACTIVE") throw new AppError("Choose an active supplier.", { code: "SUPPLIER_NOT_ACTIVE", status: 409 });
  const computed = draft.lines.map((line) => ({ ...line, ...lineAmounts(line.quantity, line.unitPrice, line.discountPercent, line.taxPercent) }));
  const totals = sumAmounts(computed);
  const poNumber = await allocateDocumentNumber(tx, "PO");
  const order = await tx.orm.public.PurchaseOrder.create({
    poNumber, supplierId: draft.supplierId, orderDate: draft.orderDate, expectedDate: draft.expectedDate, requisitionId: draft.requisitionId, rfqId: draft.rfqId,
    subtotal: totals.grossAmount, discountTotal: totals.discountAmount, taxTotal: totals.taxAmount, totalAmount: totals.lineTotal,
    notes: draft.notes, idempotencyKey: draft.idempotencyKey, createdBy: actorId,
  });
  for (const [index, line] of computed.entries()) {
    await tx.orm.public.PurchaseOrderLine.create({ purchaseOrderId: order.id, lineNo: index + 1, ...line });
  }
  await recordAuditEvent({ actorId, action: "PURCHASE_ORDER_CREATED", entityType: "PurchaseOrder", entityId: order.id, metadata: { poNumber, total: totals.lineTotal } }, tx);
  return order.id;
}

export async function createPurchaseOrder(input: PurchaseOrderInput, actorId: string) {
  const replay = await db.orm.public.PurchaseOrder.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getPurchaseOrder(replay.id);
  await requireProducts(input.lines);
  try {
    const id = await db.transaction(async (tx) => {
      if (input.requisitionId && !(await transition(tx, "erp_purchase_requisitions", input.requisitionId, ["APPROVED"], "ORDERED"))) {
        throw new AppError("Only approved, not yet ordered requisitions can be turned into a purchase order.", { code: "REQUISITION_NOT_APPROVED", status: 409 });
      }
      return insertPurchaseOrder(tx, {
        supplierId: input.supplierId, orderDate: input.orderDate, expectedDate: input.expectedDate || null, requisitionId: input.requisitionId ?? null, rfqId: null,
        notes: input.notes || null, idempotencyKey: input.idempotencyKey,
        lines: input.lines.map((line) => ({
          productId: line.productId, quantity: toPlainDecimalString(line.quantity), unitPrice: toPlainDecimalString(line.unitPrice),
          discountPercent: line.discountPercent ?? 0, taxPercent: line.taxPercent ?? 0, requisitionLineId: line.requisitionLineId ?? null,
        })),
      }, actorId);
    });
    return getPurchaseOrder(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.PurchaseOrder.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getPurchaseOrder(original.id);
    }
    throw error;
  }
}

export async function changePurchaseOrder(id: string, action: "approve" | "cancel" | "close", reason: string, actorId: string) {
  if (!UUID.test(id)) notFound("Purchase order", "PURCHASE_ORDER_NOT_FOUND");
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_purchase_orders where id = ${id}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!locked) notFound("Purchase order", "PURCHASE_ORDER_NOT_FOUND");
    const lines = await tx.orm.public.PurchaseOrderLine.where({ purchaseOrderId: id }).all();
    const received = lines.some((line) => decimalSign(dec(line.receivedQuantity)) > 0);
    const now = new Date().toISOString();
    if (action === "approve") {
      if (locked.status !== "DRAFT") throw new AppError("Only draft purchase orders can be approved.", { code: "PURCHASE_ORDER_STATUS_CONFLICT", status: 409 });
      await tx.orm.public.PurchaseOrder.where({ id }).update({ status: "APPROVED", approvedBy: actorId, approvedAt: now });
    } else if (action === "cancel") {
      if (!["DRAFT", "APPROVED"].includes(locked.status) || received) {
        throw new AppError("Only purchase orders with nothing received can be cancelled; close a partly received order instead.", { code: "PURCHASE_ORDER_STATUS_CONFLICT", status: 409 });
      }
      await tx.orm.public.PurchaseOrder.where({ id }).update({ status: "CANCELLED", closedAt: now, closeReason: reason });
    } else {
      if (locked.status !== "PARTIALLY_RECEIVED") throw new AppError("Only partly received purchase orders can be closed short.", { code: "PURCHASE_ORDER_STATUS_CONFLICT", status: 409 });
      await tx.orm.public.PurchaseOrder.where({ id }).update({ status: "CLOSED", closedAt: now, closeReason: reason });
    }
    await recordAuditEvent({ actorId, action: `PURCHASE_ORDER_${action.toUpperCase()}`, entityType: "PurchaseOrder", entityId: id, metadata: { reason: reason || null } }, tx);
  });
  return getPurchaseOrder(id);
}

export async function getPurchaseOrder(id: string) {
  if (!UUID.test(id)) notFound("Purchase order", "PURCHASE_ORDER_NOT_FOUND");
  const order = await db.orm.public.PurchaseOrder.where({ id }).first();
  if (!order) notFound("Purchase order", "PURCHASE_ORDER_NOT_FOUND");
  const lines = await db.orm.public.PurchaseOrderLine.where({ purchaseOrderId: id }).orderBy((line) => line.lineNo.asc()).all();
  const products = await productsById(lines.map((line) => line.productId));
  const supplier = await db.orm.public.Supplier.where({ id: order.supplierId }).first();
  const receipts = await db.orm.public.PurchaseReceipt.where({ purchaseOrderId: id }).orderBy((row) => row.createdAt.asc()).all();
  const bills = await db.orm.public.SupplierBill.where({ purchaseOrderId: id }).all();
  const requisition = order.requisitionId ? await db.orm.public.PurchaseRequisition.where({ id: order.requisitionId }).first() : null;
  return {
    ...order,
    subtotal: cash(order.subtotal), discountTotal: cash(order.discountTotal), taxTotal: cash(order.taxTotal), totalAmount: cash(order.totalAmount),
    supplierName: supplier?.name ?? null, supplierCode: supplier?.code ?? null, supplierAddress: supplier?.address ?? null, supplierPhone: supplier?.phone ?? null,
    requisitionNumber: requisition?.requisitionNumber ?? null,
    lines: lines.map((line) => ({
      ...line,
      quantity: dec(line.quantity), unitPrice: dec(line.unitPrice), receivedQuantity: dec(line.receivedQuantity), billedQuantity: dec(line.billedQuantity),
      outstandingQuantity: subtractDecimalStrings(dec(line.quantity), dec(line.receivedQuantity)),
      grossAmount: cash(line.grossAmount), discountAmount: cash(line.discountAmount), taxAmount: cash(line.taxAmount), lineTotal: cash(line.lineTotal),
      sku: products.get(line.productId)?.sku ?? null, productName: products.get(line.productId)?.name ?? null, unit: products.get(line.productId)?.unit ?? null,
    })),
    receipts: receipts.map((receipt) => ({ id: receipt.id, receiptNumber: receipt.receiptNumber, receivedDate: receipt.receivedDate, qualityHold: receipt.qualityHold, deliveryNoteRef: receipt.deliveryNoteRef })),
    bills: bills.map((bill) => ({ id: bill.id, billNumber: bill.billNumber, status: bill.status, totalAmount: cash(bill.totalAmount), supplierInvoiceNumber: bill.supplierInvoiceNumber })),
  };
}

export async function listPurchaseOrders(filters: ListQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select o.id::text as id, o."poNumber", o."orderDate", coalesce(o."expectedDate", '') as "expectedDate", o.status, o."totalAmount"::text as "totalAmount",
      s.name as "supplierName", s.id::text as "supplierId",
      (select coalesce(sum(quantity), 0) from erp_purchase_order_lines l where l."purchaseOrderId" = o.id)::text as ordered,
      (select coalesce(sum("receivedQuantity"), 0) from erp_purchase_order_lines l where l."purchaseOrderId" = o.id)::text as received
    from erp_purchase_orders o join erp_suppliers s on s.id = o."supplierId"
    where (${filters.status} = '' or o.status = ${filters.status} or (${filters.status} = 'OPEN' and o.status in ('APPROVED', 'PARTIALLY_RECEIVED')))
      and (${filters.supplierId ?? ""} = '' or o."supplierId"::text = ${filters.supplierId ?? ""})
      and (${filters.search} = '' or o."poNumber" ilike ${pattern} or s.name ilike ${pattern})
    order by o."createdAt" desc, o.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", poNumber: "pg/text@1", orderDate: "pg/text@1", expectedDate: "pg/text@1", status: "pg/text@1", totalAmount: "pg/text@1", supplierName: "pg/text@1", supplierId: "pg/text@1", ordered: "pg/text@1", received: "pg/text@1" }).build());
  return {
    purchaseOrders: result.slice(0, filters.pageSize).map((row) => ({ ...row, totalAmount: cash(row.totalAmount), ordered: dec(row.ordered), received: dec(row.received), expectedDate: row.expectedDate || null })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Goods receipts                                                      */
/* ------------------------------------------------------------------ */

export async function receivePurchaseOrder(input: ReceiptInput, actorId: string) {
  const replay = await db.orm.public.PurchaseReceipt.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getPurchaseReceipt(replay.id);
  const ids = input.lines.map((line) => line.purchaseOrderLineId);
  if (new Set(ids).size !== ids.length) throw new AppError("Each PO line can appear once per receipt.", { code: "RECEIPT_DUPLICATE_LINE", status: 400 });

  try {
    const id = await db.transaction(async (tx) => {
      const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_purchase_orders where id = ${input.purchaseOrderId}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
      if (!locked) notFound("Purchase order", "PURCHASE_ORDER_NOT_FOUND");
      if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(locked.status)) {
        throw new AppError("Goods can only be received against approved, open purchase orders.", { code: "PURCHASE_ORDER_NOT_OPEN", status: 409 });
      }
      const order = (await tx.orm.public.PurchaseOrder.where({ id: input.purchaseOrderId }).first())!;
      const lines = await tx.orm.public.PurchaseOrderLine.where({ purchaseOrderId: order.id }).all();
      const products = await productsById(lines.map((line) => line.productId));
      const receiptNumber = await allocateDocumentNumber(tx, "PGR");
      const receipt = await tx.orm.public.PurchaseReceipt.create({
        receiptNumber, purchaseOrderId: order.id, locationId: input.locationId, receivedDate: input.receivedDate, deliveryNoteRef: input.deliveryNoteRef || null,
        qualityHold: input.qualityHold, notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      const stockLines: Array<{ productId: string; locationId: string; quantity: number }> = [];
      for (const item of input.lines) {
        const line = lines.find((row) => row.id === item.purchaseOrderLineId);
        if (!line) throw new AppError("A received line does not belong to this purchase order.", { code: "PO_LINE_NOT_FOUND", status: 400 });
        const product = products.get(line.productId)!;
        const precision = quantityPrecisionError(item.quantity, product.unit);
        if (precision) throw new AppError(`${product.sku}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
        const quantity = toPlainDecimalString(item.quantity);
        const after = addDecimalStrings(dec(line.receivedQuantity), quantity);
        if (compareDecimalStrings(after, dec(line.quantity)) > 0) {
          throw new AppError(`${product.sku}: only ${subtractDecimalStrings(dec(line.quantity), dec(line.receivedQuantity))} ${product.unit} is still to be received on this order.`, { code: "RECEIPT_EXCEEDS_ORDER", status: 409 });
        }
        await tx.orm.public.PurchaseOrderLine.where({ id: line.id }).update({ receivedQuantity: after });
        line.receivedQuantity = after as never;
        await tx.orm.public.PurchaseReceiptLine.create({ receiptId: receipt.id, purchaseOrderLineId: line.id, quantity });
        stockLines.push({ productId: line.productId, locationId: input.locationId, quantity: item.quantity });
      }
      const common = { reference: `${order.poNumber} / ${receiptNumber}`, notes: input.deliveryNoteRef ? `Supplier delivery note ${input.deliveryNoteRef}` : "", sourceType: "PurchaseReceipt", sourceId: receipt.id };
      await postStockDocumentInTransaction(tx, { ...common, documentType: "GOODS_RECEIPT", idempotencyKey: `pgr-${receipt.id}`, reason: "", lines: stockLines }, actorId);
      if (input.qualityHold) {
        await postStockDocumentInTransaction(tx, { ...common, documentType: "QC_HOLD", idempotencyKey: `pgr-hold-${receipt.id}`, reason: `Incoming inspection for ${receiptNumber}`, lines: stockLines }, actorId);
      }
      const complete = lines.every((line) => compareDecimalStrings(dec(line.receivedQuantity), dec(line.quantity)) === 0);
      await tx.orm.public.PurchaseOrder.where({ id: order.id }).update({ status: complete ? "RECEIVED" : "PARTIALLY_RECEIVED", closedAt: complete ? new Date().toISOString() : null });
      await recordAuditEvent({ actorId, action: "PURCHASE_GOODS_RECEIVED", entityType: "PurchaseOrder", entityId: order.id, metadata: { receiptNumber, lines: stockLines.length, qualityHold: input.qualityHold } }, tx);
      return receipt.id;
    });
    return getPurchaseReceipt(id);
  } catch (error) {
    if (isUnique(error, "idempotencyKey")) {
      const original = await db.orm.public.PurchaseReceipt.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getPurchaseReceipt(original.id);
    }
    throw error;
  }
}

export async function getPurchaseReceipt(id: string) {
  const receipt = await db.orm.public.PurchaseReceipt.where({ id }).first();
  if (!receipt) notFound("Receipt", "RECEIPT_NOT_FOUND");
  const lines = await db.orm.public.PurchaseReceiptLine.where({ receiptId: id }).all();
  const poLines = lines.length ? await db.orm.public.PurchaseOrderLine.where((line) => line.id.in(lines.map((item) => item.purchaseOrderLineId))).all() : [];
  const products = await productsById(poLines.map((line) => line.productId));
  const order = await db.orm.public.PurchaseOrder.where({ id: receipt.purchaseOrderId }).first();
  const documents = await db.orm.public.StockDocument.where({ sourceType: "PurchaseReceipt", sourceId: id }).all();
  return {
    ...receipt,
    poNumber: order?.poNumber ?? null,
    lines: lines.map((line) => {
      const poLine = poLines.find((item) => item.id === line.purchaseOrderLineId);
      const product = poLine ? products.get(poLine.productId) : undefined;
      return { ...line, quantity: dec(line.quantity), sku: product?.sku ?? null, productName: product?.name ?? null, unit: product?.unit ?? null };
    }),
    stockDocuments: documents.map((document) => ({ id: document.id, documentNumber: document.documentNumber, documentType: document.documentType })),
  };
}

export async function listPurchaseReceipts(filters: ListQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select r.id::text as id, r."receiptNumber", r."receivedDate", r."qualityHold"::text as "qualityHold", coalesce(r."deliveryNoteRef", '') as "deliveryNoteRef",
      o.id::text as "purchaseOrderId", o."poNumber", s.name as "supplierName",
      (select coalesce(sum(quantity), 0) from erp_purchase_receipt_lines l where l."receiptId" = r.id)::text as quantity,
      coalesce(o."expectedDate", '') as "expectedDate"
    from erp_purchase_receipts r join erp_purchase_orders o on o.id = r."purchaseOrderId" join erp_suppliers s on s.id = o."supplierId"
    where (${filters.search} = '' or r."receiptNumber" ilike ${pattern} or o."poNumber" ilike ${pattern} or s.name ilike ${pattern})
      and (${filters.supplierId ?? ""} = '' or s.id::text = ${filters.supplierId ?? ""})
    order by r."createdAt" desc, r.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", receiptNumber: "pg/text@1", receivedDate: "pg/text@1", qualityHold: "pg/text@1", deliveryNoteRef: "pg/text@1", purchaseOrderId: "pg/text@1", poNumber: "pg/text@1", supplierName: "pg/text@1", quantity: "pg/text@1", expectedDate: "pg/text@1" }).build());
  return {
    receipts: result.slice(0, filters.pageSize).map((row) => ({ ...row, qualityHold: row.qualityHold === "true", quantity: dec(row.quantity) })),
    page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize,
  };
}

/* On-time and fill-rate per supplier, from receipts against promised dates. */
export async function getSupplierPerformance() {
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select s.id::text as id, s.code, s.name,
      (select count(*) from erp_purchase_orders o where o."supplierId" = s.id and o.status not in ('DRAFT', 'CANCELLED'))::text as orders,
      (select coalesce(sum(o."totalAmount"), 0) from erp_purchase_orders o where o."supplierId" = s.id and o.status not in ('DRAFT', 'CANCELLED'))::text as "orderedValue",
      (select count(*) from erp_purchase_receipts r join erp_purchase_orders o on o.id = r."purchaseOrderId" where o."supplierId" = s.id)::text as receipts,
      (select count(*) from erp_purchase_receipts r join erp_purchase_orders o on o.id = r."purchaseOrderId" where o."supplierId" = s.id and o."expectedDate" is not null)::text as "datedReceipts",
      (select count(*) from erp_purchase_receipts r join erp_purchase_orders o on o.id = r."purchaseOrderId" where o."supplierId" = s.id and o."expectedDate" is not null and r."receivedDate" <= o."expectedDate")::text as "onTimeReceipts",
      (select coalesce(sum(l.quantity), 0) from erp_purchase_order_lines l join erp_purchase_orders o on o.id = l."purchaseOrderId" where o."supplierId" = s.id and o.status in ('RECEIVED', 'CLOSED'))::text as "closedOrdered",
      (select coalesce(sum(l."receivedQuantity"), 0) from erp_purchase_order_lines l join erp_purchase_orders o on o.id = l."purchaseOrderId" where o."supplierId" = s.id and o.status in ('RECEIVED', 'CLOSED'))::text as "closedReceived"
    from erp_suppliers s order by s.name
  `.returnsRow({ id: "pg/text@1", code: "pg/text@1", name: "pg/text@1", orders: "pg/text@1", orderedValue: "pg/text@1", receipts: "pg/text@1", datedReceipts: "pg/text@1", onTimeReceipts: "pg/text@1", closedOrdered: "pg/text@1", closedReceived: "pg/text@1" }).build());
  const pct = (part: string, whole: string) => (Number(whole) > 0 ? ((Number(part) / Number(whole)) * 100).toFixed(1) : null);
  return result.map((row) => ({
    id: row.id, code: row.code, name: row.name,
    orders: Number(row.orders), orderedValue: cash(row.orderedValue), receipts: Number(row.receipts),
    onTimePercent: pct(row.onTimeReceipts, row.datedReceipts),
    fillRatePercent: pct(row.closedReceived, row.closedOrdered),
  }));
}

/* Confirmed MRP BUY planned orders that are not on a requisition yet. */
export async function listBuySuggestions() {
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select p.id::text as id, p."productId"::text as "productId", p.quantity::text as quantity, coalesce(p."dueDate", '') as "dueDate",
      i.sku, i.name as "productName", i.unit, r."runNumber"
    from erp_mrp_planned_orders p join erp_products i on i.id = p."productId" join erp_mrp_runs r on r.id = p."runId"
    where p.status = 'CONFIRMED' and p."orderType" = 'BUY'
      and not exists (select 1 from erp_purchase_requisition_lines l where l."plannedOrderId" = p.id)
    order by p."dueDate" nulls last, i.sku
    limit 200
  `.returnsRow({ id: "pg/text@1", productId: "pg/text@1", quantity: "pg/text@1", dueDate: "pg/text@1", sku: "pg/text@1", productName: "pg/text@1", unit: "pg/text@1", runNumber: "pg/text@1" }).build());
  return result.map((row) => ({ ...row, quantity: dec(row.quantity), dueDate: row.dueDate || null }));
}

/* Counts for the procurement overview. */
export async function getProcurementSummary(asOf = new Date().toISOString().slice(0, 10)) {
  const [row] = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select
      (select count(*) from erp_purchase_requisitions where status = 'SUBMITTED')::text as "requisitionsToApprove",
      (select count(*) from erp_purchase_requisitions where status = 'APPROVED')::text as "requisitionsToOrder",
      (select count(*) from erp_rfqs where status = 'OPEN')::text as "openRfqs",
      (select count(*) from erp_purchase_orders where status = 'DRAFT')::text as "draftOrders",
      (select count(*) from erp_purchase_orders where status in ('APPROVED', 'PARTIALLY_RECEIVED'))::text as "openOrders",
      (select coalesce(sum("totalAmount"), 0) from erp_purchase_orders where status in ('APPROVED', 'PARTIALLY_RECEIVED'))::text as "openOrderValue",
      (select count(*) from erp_purchase_orders where status in ('APPROVED', 'PARTIALLY_RECEIVED') and "expectedDate" < ${asOf})::text as "lateOrders",
      (select count(*) from erp_purchase_receipts where "receivedDate" > to_char(${asOf}::date - 30, 'YYYY-MM-DD'))::text as "receipts30",
      (select count(*) from erp_suppliers where status = 'ACTIVE')::text as "activeSuppliers",
      (select count(*) from erp_mrp_planned_orders p where p.status = 'CONFIRMED' and p."orderType" = 'BUY'
        and not exists (select 1 from erp_purchase_requisition_lines l where l."plannedOrderId" = p.id))::text as "buySuggestions"
  `.returnsRow({ requisitionsToApprove: "pg/text@1", requisitionsToOrder: "pg/text@1", openRfqs: "pg/text@1", draftOrders: "pg/text@1", openOrders: "pg/text@1", openOrderValue: "pg/text@1", lateOrders: "pg/text@1", receipts30: "pg/text@1", activeSuppliers: "pg/text@1", buySuggestions: "pg/text@1" }).build());
  return Object.fromEntries(Object.entries(row).map(([name, value]) => [name, name === "openOrderValue" ? cash(value) : Number(value)])) as Record<string, number | string>;
}
