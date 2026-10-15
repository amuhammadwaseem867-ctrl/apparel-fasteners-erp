import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { createLocation, createWarehouse, postStockDocument } from "../../server/inventory/inventory.service.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { runMrp, setPlannedOrderStatus } from "../../server/planning/mrp.service.ts";
import { changeBill, createBill, getBill, getPayables, recordSupplierPayment, voidSupplierPayment } from "../../server/procurement/payables.service.ts";
import {
  awardRfq,
  changePurchaseOrder,
  changeRequisition,
  createPurchaseOrder,
  createRequisition,
  createRfq,
  createSupplier,
  getPurchaseOrder,
  getSupplierPerformance,
  receivePurchaseOrder,
  saveQuote,
} from "../../server/procurement/procurement.service.ts";
import {
  billInputSchema,
  purchaseOrderInputSchema,
  quoteInputSchema,
  receiptInputSchema,
  requisitionInputSchema,
  rfqInputSchema,
  supplierInputSchema,
  supplierPaymentInputSchema,
} from "../../server/procurement/procurement.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `U${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const key = () => randomUUID();

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

const po = (lines, extra = {}) => createPurchaseOrder(purchaseOrderInputSchema.parse({ idempotencyKey: key(), supplierId: ctx.supplier.id, orderDate: "2026-10-15", expectedDate: "2026-10-25", lines, ...extra }), actor);
const receive = (order, lines, extra = {}) => receivePurchaseOrder(receiptInputSchema.parse({
  idempotencyKey: key(), purchaseOrderId: order.id, locationId: ctx.loc.id, receivedDate: "2026-10-20",
  lines: lines.map(([index, quantity]) => ({ purchaseOrderLineId: order.lines[index].id, quantity })), ...extra,
}), actor);
const bill = (order, invoiceNumber, lines, extra = {}) => createBill(billInputSchema.parse({
  idempotencyKey: key(), supplierId: ctx.supplier.id, purchaseOrderId: order.id, supplierInvoiceNumber: invoiceNumber, billDate: "2026-10-21",
  lines: lines.map(([index, quantity, unitPrice]) => ({ purchaseOrderLineId: order.lines[index].id, quantity, ...(unitPrice === undefined ? {} : { unitPrice }) })), ...extra,
}), actor);
const pay = (billId, amount) => recordSupplierPayment(supplierPaymentInputSchema.parse({ idempotencyKey: key(), billId, paymentDate: "2026-10-22", method: "BANK_TRANSFER", amount }), actor);

async function onHand(productId, locationId = ctx.loc.id) {
  const row = await db.orm.public.StockBalance.where({ productId, locationId }).first();
  return { onHand: String(row?.onHand ?? "0"), qcHold: String(row?.qualityHold ?? "0") };
}

test.before(async () => {
  const product = (code, unit) => createProduct({ sku: `${code}-${run}`, name: `${code} ${run}`, category: "Test", productType: "Raw Material", unit, unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.tape = await product("TAPE", "Meters");
  ctx.slider = await product("SLD", "Pcs");
  const warehouse = await createWarehouse({ code: `PU-${run}`, name: "Stores", warehouseType: "RAW_MATERIAL" }, actor);
  ctx.loc = await createLocation({ warehouseId: warehouse.id, code: "R1", name: "R1" }, actor);
  ctx.supplier = await createSupplier(supplierInputSchema.parse({ code: `S-${run}`, name: `Supplier ${run}`, paymentTermsDays: 30 }), actor);
  ctx.other = await createSupplier(supplierInputSchema.parse({ code: `T-${run}`, name: `Other ${run}`, paymentTermsDays: 15 }), actor);
});

test("supplier codes are unique", async () => {
  await expectCode(createSupplier(supplierInputSchema.parse({ code: `S-${run}`, name: "Duplicate" }), actor), "SUPPLIER_EXISTS");
});

test("requisition workflow, RFQ comparison and award to a draft PO", async () => {
  const pr = await createRequisition(requisitionInputSchema.parse({ idempotencyKey: key(), lines: [{ productId: ctx.tape.id, quantity: 500 }, { productId: ctx.slider.id, quantity: 1000 }] }), actor);
  assert.match(pr.requisitionNumber, /^PR-/);
  await expectCode(changeRequisition(pr.id, "approve", "", actor), "REQUISITION_STATUS_CONFLICT");
  await changeRequisition(pr.id, "submit", "", actor);
  await expectCode(createRfq(rfqInputSchema.parse({ idempotencyKey: key(), requisitionId: pr.id }), actor), "REQUISITION_NOT_APPROVED");
  await changeRequisition(pr.id, "approve", "ok", actor);

  const rfq = await createRfq(rfqInputSchema.parse({ idempotencyKey: key(), requisitionId: pr.id }), actor);
  assert.equal(rfq.lines.length, 2);
  const prices = (tape, slider) => rfq.lines.map((line) => ({ rfqLineId: line.id, unitPrice: line.productId === ctx.tape.id ? tape : slider }));
  await expectCode(saveQuote(rfq.id, quoteInputSchema.parse({ supplierId: ctx.supplier.id, prices: prices(0.5, 0.1).slice(0, 1) }), actor), "QUOTE_INCOMPLETE");
  await saveQuote(rfq.id, quoteInputSchema.parse({ supplierId: ctx.supplier.id, leadTimeDays: 7, taxPercent: 17, prices: prices(0.5, 0.1) }), actor);
  const compared = await saveQuote(rfq.id, quoteInputSchema.parse({ supplierId: ctx.other.id, prices: prices(0.6, 0.12) }), actor);
  // 500 × 0.5 + 1000 × 0.1 = 350.00, + 17 % tax = 409.50; the other is 420.00.
  assert.deepEqual(compared.quotes.map((quote) => [quote.supplierId, quote.totalAmount]), [[ctx.supplier.id, "409.50"], [ctx.other.id, "420.00"]]);

  const awardKey = key();
  const order = await awardRfq(rfq.id, compared.quotes[0].id, awardKey, actor);
  assert.equal(order.status, "DRAFT");
  assert.equal(order.totalAmount, "409.50");
  assert.equal(order.requisitionId, pr.id);
  await expectCode(awardRfq(rfq.id, compared.quotes[1].id, key(), actor), "RFQ_NOT_OPEN");
  const ordered = await changeRequisition(pr.id, "cancel", "", actor).catch((error) => error);
  assert.equal(ordered.code, "REQUISITION_STATUS_CONFLICT", "an ordered requisition cannot be cancelled");
});

test("receipts never exceed the order, post stock (and QC hold) atomically, and are idempotent", async () => {
  const order = await po([{ productId: ctx.tape.id, quantity: 100.5, unitPrice: 2.25, taxPercent: 10 }, { productId: ctx.slider.id, quantity: 200, unitPrice: 0.335 }]);
  await expectCode(receive(order, [[0, 10]]), "PURCHASE_ORDER_NOT_OPEN");
  await changePurchaseOrder(order.id, "approve", "", actor);

  const before = await onHand(ctx.tape.id);
  const replayKey = key();
  const first = await receive(order, [[0, 60.5]], { idempotencyKey: replayKey, qualityHold: true, deliveryNoteRef: "DN-1" });
  const replay = await receive(order, [[0, 60.5]], { idempotencyKey: replayKey, qualityHold: true });
  assert.equal(replay.id, first.id, "replay returns the same receipt");
  assert.deepEqual(first.stockDocuments.map((doc) => doc.documentType).sort(), ["GOODS_RECEIPT", "QC_HOLD"]);
  const after = await onHand(ctx.tape.id);
  assert.equal(Number(after.onHand) - Number(before.onHand), 60.5);
  assert.equal(Number(after.qcHold) - Number(before.qcHold), 60.5, "held for incoming inspection");

  await expectCode(receive(order, [[0, 40.5]]), "RECEIPT_EXCEEDS_ORDER");
  await expectCode(receive(order, [[1, 0.5]]), "QUANTITY_PRECISION");
  await expectCode(postStockDocument(stockDocumentInputSchema.parse({ documentType: "GOODS_RECEIPT", idempotencyKey: key(), sourceType: "PurchaseReceipt", sourceId: first.id, lines: [{ productId: ctx.tape.id, locationId: ctx.loc.id, quantity: 1 }] }), actor), "SOURCE_NOT_ALLOWED");

  // Concurrent receipts of the last 40 m: exactly one succeeds.
  const outcomes = await Promise.allSettled([receive(order, [[0, 40]]), receive(order, [[0, 40]]), receive(order, [[0, 40]])]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.ok(outcomes.filter((outcome) => outcome.status === "rejected").every((outcome) => outcome.reason.code === "RECEIPT_EXCEEDS_ORDER"));

  let current = await getPurchaseOrder(order.id);
  assert.equal(current.status, "PARTIALLY_RECEIVED");
  assert.equal(current.lines[0].receivedQuantity, "100.5");
  await expectCode(changePurchaseOrder(order.id, "cancel", "no longer needed", actor), "PURCHASE_ORDER_STATUS_CONFLICT");
  await receive(order, [[1, 200]]);
  current = await getPurchaseOrder(order.id);
  assert.equal(current.status, "RECEIVED");
  ctx.received = current;
});

test("bills match receipts: billed never exceeds received, prices above PO are refused, invoice numbers are unique", async () => {
  const order = ctx.received;
  await expectCode(bill(order, `INV-${run}-X`, [[0, 101]]), "BILL_EXCEEDS_RECEIVED");

  const high = await bill(order, `INV-${run}-H`, [[1, 10, 0.4]]);
  await expectCode(changeBill(high.id, "approve", "", actor), "BILL_PRICE_ABOVE_PO");
  await changeBill(high.id, "cancel", "price disputed", actor);

  // 100.5 × 2.25 = 226.13 (half up from 226.125), + 10 % tax 22.61 = 248.74; 200 × 0.335 = 67.00.
  const first = await bill(order, `INV-${run}-1`, [[0, 100.5], [1, 200]]);
  assert.equal(first.totalAmount, "315.74");
  assert.equal(first.dueDate, "2026-11-20", "due date from the supplier's 30-day terms");
  await expectCode(bill(order, `INV-${run}-1`, [[1, 1]]), "SUPPLIER_INVOICE_DUPLICATE");

  // Two drafts for the same received quantity: only one can be approved.
  const second = await bill(order, `INV-${run}-2`, [[1, 200]]);
  const outcomes = await Promise.allSettled([changeBill(first.id, "approve", "", actor), changeBill(second.id, "approve", "", actor)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const approved = outcomes[0].status === "fulfilled" ? first : second;
  const refused = approved === first ? second : first;
  await expectCode(changeBill(refused.id, "approve", "", actor), "BILL_EXCEEDS_RECEIVED");
  await changeBill(refused.id, "cancel", "duplicate", actor);
  if (approved !== first) {
    // Keep the full bill as the approved one for the payment test.
    await changeBill(second.id, "cancel", "re-billing in full", actor);
    const full = await bill(order, `INV-${run}-3`, [[0, 100.5], [1, 200]]);
    ctx.bill = await changeBill(full.id, "approve", "", actor);
  } else {
    ctx.bill = await getBill(first.id);
  }
  const po = await getPurchaseOrder(order.id);
  assert.deepEqual(po.lines.map((line) => line.billedQuantity), ["100.5", "200"]);
});

test("payments are limited to the outstanding balance, concurrent payments cannot overpay, voids restore it", async () => {
  const id = ctx.bill.id;
  await expectCode(pay(id, 315.75), "PAYMENT_EXCEEDS_OUTSTANDING");
  const outcomes = await Promise.allSettled([pay(id, 200), pay(id, 200), pay(id, 200)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  let current = await getBill(id);
  assert.equal(current.outstandingAmount, "115.74");
  assert.equal(current.paymentStatus, "PARTIALLY_PAID");
  await expectCode(changeBill(id, "cancel", "x", actor), "BILL_HAS_PAYMENTS");

  const payables = await getPayables("2026-10-25");
  const row = payables.suppliers.find((item) => item.supplierId === ctx.supplier.id);
  assert.equal(row.total, "115.74");
  assert.equal(row.buckets.current, "115.74");
  assert.equal((await getPayables("2026-12-01")).suppliers.find((item) => item.supplierId === ctx.supplier.id).buckets["1-30"], "115.74");

  const last = await pay(id, 115.74);
  current = await getBill(id);
  assert.equal(current.paymentStatus, "PAID");
  await voidSupplierPayment(last.id, "bounced cheque", actor);
  await expectCode(voidSupplierPayment(last.id, "again", actor), "PAYMENT_STATUS_CONFLICT");
  assert.equal((await getBill(id)).outstandingAmount, "115.74");
});

test("partly received orders close short; performance reflects on-time receipts and fill rate", async () => {
  const order = await po([{ productId: ctx.slider.id, quantity: 100, unitPrice: 0.1 }], { expectedDate: "2026-10-18" });
  await changePurchaseOrder(order.id, "approve", "", actor);
  await receive(order, [[0, 50]]);
  await changePurchaseOrder(order.id, "close", "supplier short-shipped", actor);
  await expectCode(receive(order, [[0, 1]]), "PURCHASE_ORDER_NOT_OPEN");

  const performance = (await getSupplierPerformance()).find((row) => row.id === ctx.supplier.id);
  // Receipts dated 2026-10-20: three against 2026-10-25 (on time), one against 2026-10-18 (late).
  assert.equal(performance.receipts, 4);
  assert.equal(performance.onTimePercent, "75.0");
  // Closed/received orders: ordered 100.5 + 200 + 100, received 100.5 + 200 + 50.
  assert.equal(performance.fillRatePercent, (350.5 / 400.5 * 100).toFixed(1));
});

test("confirmed MRP BUY planned orders become requisition lines exactly once", async () => {
  const button = await createProduct({ sku: `BTN-${run}`, name: `Button ${run}`, category: "Test", productType: "Raw Material", unit: "Pcs", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  const customer = await createCustomer({ code: `PUC-${run}`, name: "Procurement customer" }, actor);
  const order = await createSalesOrder({ customerId: customer.id, orderDate: "2026-10-15", deliveryDate: "2026-11-30", lines: [{ kind: "catalog", productId: button.id, quantity: 750, unitPrice: 1, discountPercent: 0, taxPercent: 0 }] }, actor);
  await changeSalesOrderStatus(order.id, "approve", actor);
  const mrp = await runMrp({}, actor);
  const planned = mrp.plannedOrders.find((row) => row.productId === button.id);
  assert.equal(planned.orderType, "BUY");

  await expectCode(createRequisition(requisitionInputSchema.parse({ idempotencyKey: key(), plannedOrderIds: [planned.id] }), actor), "PLANNED_ORDER_NOT_CONVERTIBLE");
  await setPlannedOrderStatus(planned.id, "CONFIRMED", actor);
  const outcomes = await Promise.allSettled([1, 2].map(() => createRequisition(requisitionInputSchema.parse({ idempotencyKey: key(), plannedOrderIds: [planned.id] }), actor)));
  const ok = outcomes.filter((outcome) => outcome.status === "fulfilled");
  assert.equal(ok.length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "PLANNED_ORDER_ALREADY_CONVERTED");
  assert.equal(ok[0].value.lines[0].quantity, "750");
  assert.equal(ok[0].value.lines[0].plannedOrderId, planned.id);
});
