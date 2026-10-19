import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { changeShipment, createShipment } from "../../server/dispatch/dispatch.service.ts";
import { shipmentInputSchema } from "../../server/dispatch/dispatch.validation.ts";
import { addMoney, lineAmounts } from "../../server/finance/finance-rules.ts";
import {
  changeInvoice,
  createCreditNote,
  createInvoice,
  getInvoice,
  getReceivables,
  listInvoices,
  listUninvoicedShipments,
  recordReceipt,
  voidReceipt,
} from "../../server/finance/finance.service.ts";
import {
  creditNoteInputSchema,
  invoiceInputSchema,
  invoiceQuerySchema,
  receiptInputSchema,
} from "../../server/finance/finance.validation.ts";
import { createLocation, createWarehouse, postStockDocument } from "../../server/inventory/inventory.service.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `I${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const key = () => randomUUID();

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

const invoice = (shipmentId, extra = {}) => createInvoice(invoiceInputSchema.parse({ idempotencyKey: key(), shipmentId, invoiceDate: "2026-10-15", paymentTermsDays: 30, ...extra }), actor);
const receipt = (invoiceId, amount, extra = {}) => recordReceipt(receiptInputSchema.parse({ idempotencyKey: key(), invoiceId, receiptDate: "2026-10-20", method: "BANK_TRANSFER", amount, ...extra }), actor);
const credit = (invoiceId, lines) => createCreditNote(creditNoteInputSchema.parse({ idempotencyKey: key(), invoiceId, creditDate: "2026-10-21", reason: "Returned goods", lines }), actor);

async function shipLoose(salesOrderId, lines) {
  const shipment = await createShipment(shipmentInputSchema.parse({ idempotencyKey: key(), salesOrderId, locationId: ctx.fg.id, lines }), actor);
  return shipment;
}

test.before(async () => {
  const product = (code, unit, price) => createProduct({ sku: `${code}-${run}`, name: `${code} ${run}`, category: "Test", productType: "Finished Good", unit, unitPrice: price, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.zip = await product("ZIP", "Pcs", 0.0375);
  ctx.sld = await product("SLD", "Pcs", 0.335);
  const warehouse = await createWarehouse({ code: `IF-${run}`, name: "FG", warehouseType: "FINISHED_GOODS" }, actor);
  ctx.fg = await createLocation({ warehouseId: warehouse.id, code: "F1", name: "F1" }, actor);
  await postStockDocument(stockDocumentInputSchema.parse({
    documentType: "FG_RECEIPT", idempotencyKey: key(),
    lines: [{ productId: ctx.zip.id, locationId: ctx.fg.id, quantity: 5000 }, { productId: ctx.sld.id, locationId: ctx.fg.id, quantity: 500 }],
  }), actor);

  ctx.customer = await createCustomer({ code: `IC-${run}`, name: `Invoice customer ${run}` }, actor);
  ctx.order = await createSalesOrder({
    customerId: ctx.customer.id, orderDate: "2026-10-15", deliveryDate: "2026-11-15",
    lines: [
      { kind: "catalog", productId: ctx.zip.id, quantity: 1000, unitPrice: 0.0375, discountPercent: 10, taxPercent: 17 },
      { kind: "catalog", productId: ctx.sld.id, quantity: 3, unitPrice: 0.335, discountPercent: 0, taxPercent: 17 },
    ],
  }, actor);
  await changeSalesOrderStatus(ctx.order.id, "approve", actor);
  ctx.shipment = await shipLoose(ctx.order.id, [{ productId: ctx.zip.id, quantity: 1000 }, { productId: ctx.sld.id, quantity: 3 }]);
});

test("only dispatched shipments are invoiced; amounts come from the sales order exactly", async () => {
  await expectCode(invoice(ctx.shipment.id), "SHIPMENT_NOT_DISPATCHED");
  await changeShipment(ctx.shipment.id, "dispatch", {}, actor);
  assert.ok((await listUninvoicedShipments()).some((row) => row.id === ctx.shipment.id));

  const created = await invoice(ctx.shipment.id, { paymentTermsDays: 30 });
  assert.equal(created.status, "DRAFT");
  assert.equal(created.dueDate, "2026-11-14");
  assert.match(created.invoiceNumber, /^INV-\d{4}-\d{6}$/);
  const zip = lineAmounts("1000", "0.0375", 10, 17);
  const sld = lineAmounts("3", "0.335", 0, 17);
  assert.deepEqual(created.lines.map((line) => line.lineTotal), [zip.lineTotal, sld.lineTotal]);
  assert.deepEqual([created.subtotal, created.discountTotal, created.taxTotal, created.totalAmount], ["38.51", "3.75", "5.91", "40.67"]);
  ctx.invoice = created;
});

test("one active invoice per shipment, even when created concurrently", async () => {
  const outcomes = await Promise.allSettled([invoice(ctx.shipment.id), invoice(ctx.shipment.id)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.reason?.code), ["INVOICE_EXISTS", "INVOICE_EXISTS"], "the draft already holds the shipment");

  await changeInvoice(ctx.invoice.id, "cancel", "Wrong date", actor);
  const again = await Promise.allSettled([invoice(ctx.shipment.id), invoice(ctx.shipment.id)]);
  assert.equal(again.filter((outcome) => outcome.status === "fulfilled").length, 1);
  ctx.invoice = again.find((outcome) => outcome.status === "fulfilled").value;

  await expectCode(receipt(ctx.invoice.id, 1), "INVOICE_NOT_ISSUED");
  const issued = await changeInvoice(ctx.invoice.id, "issue", "", actor);
  assert.equal(issued.status, "ISSUED");
  assert.equal(issued.paymentStatus, "UNPAID");
  await expectCode(changeInvoice(ctx.invoice.id, "cancel", "too late", actor), "INVOICE_STATUS_CONFLICT");
});

test("receipts never exceed the outstanding balance, even concurrently; voids restore it", async () => {
  await expectCode(receipt(ctx.invoice.id, 40.68), "RECEIPT_EXCEEDS_OUTSTANDING");
  const outcomes = await Promise.allSettled([receipt(ctx.invoice.id, 25), receipt(ctx.invoice.id, 25), receipt(ctx.invoice.id, 25)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const posted = outcomes.find((outcome) => outcome.status === "fulfilled").value;

  let state = await getInvoice(ctx.invoice.id);
  assert.deepEqual([state.received, state.outstanding, state.paymentStatus], ["25.00", "15.67", "PARTIALLY_PAID"]);

  const voided = await voidReceipt(posted.id, "Bounced cheque", actor);
  assert.equal(voided.status, "VOIDED");
  await expectCode(voidReceipt(posted.id, "again", actor), "RECEIPT_STATUS_CONFLICT");
  state = await getInvoice(ctx.invoice.id);
  assert.equal(state.outstanding, "40.67");
  ctx.paid = await receipt(ctx.invoice.id, 30);

  // The ledger moved with each document, in the same transaction (D-030).
  const ar = (await db.orm.public.LedgerAccount.where({ systemKey: "AR" }).first()).id;
  const arNet = async (sourceType, sourceId) => {
    const entries = await db.orm.public.JournalEntry.where({ sourceType, sourceId }).all();
    const lines = entries.length ? await db.orm.public.JournalLine.where((line) => line.entryId.in(entries.map((entry) => entry.id))).all() : [];
    return lines.filter((line) => line.accountId === ar).reduce((sum, line) => sum + Math.round(Number(line.debit) * 100) - Math.round(Number(line.credit) * 100), 0) / 100;
  };
  assert.equal(await arNet("Invoice", ctx.invoice.id), 40.67, "issuing debits receivables with the invoice total");
  assert.equal(await arNet("CustomerReceipt", posted.id), 0, "a voided receipt is reversed");
  assert.equal(await arNet("CustomerReceipt", ctx.paid.id), -30);
});

test("credit notes are limited by invoiced quantity and outstanding balance", async () => {
  const [zipLine, sldLine] = ctx.invoice.lines;
  await expectCode(credit(ctx.invoice.id, [{ invoiceLineId: sldLine.id, quantity: 4 }]), "CREDIT_EXCEEDS_INVOICED");
  await expectCode(credit(ctx.invoice.id, [{ invoiceLineId: zipLine.id, quantity: 1000 }]), "CREDIT_EXCEEDS_OUTSTANDING");

  const first = await credit(ctx.invoice.id, [{ invoiceLineId: sldLine.id, quantity: 1 }]);
  const second = await credit(ctx.invoice.id, [{ invoiceLineId: sldLine.id, quantity: 2 }]);
  assert.equal(addMoney(first.totalAmount, second.totalAmount), sldLine.lineTotal, "credits of the whole line add up to the line exactly");
  await expectCode(credit(ctx.invoice.id, [{ invoiceLineId: sldLine.id, quantity: 0.5 }]), "CREDIT_EXCEEDS_INVOICED");

  const state = await getInvoice(ctx.invoice.id);
  assert.equal(state.credited, sldLine.lineTotal);
  assert.equal(state.outstanding, "9.49");
  assert.equal(state.lines[1].creditedQuantity, "3");
  await receipt(ctx.invoice.id, 9.49);
  const settled = await getInvoice(ctx.invoice.id);
  assert.deepEqual([settled.outstanding, settled.paymentStatus], ["0.00", "PAID"]);
  const paid = await listInvoices(invoiceQuerySchema.parse({ balance: "paid", search: ctx.invoice.invoiceNumber }));
  assert.equal(paid.invoices.length, 1);
});

test("receivables age outstanding invoices by due date", async () => {
  const order = await createSalesOrder({
    customerId: ctx.customer.id, orderDate: "2026-06-01",
    lines: [{ kind: "catalog", productId: ctx.zip.id, quantity: 100, unitPrice: 0.0375, discountPercent: 0, taxPercent: 17 }],
  }, actor);
  await changeSalesOrderStatus(order.id, "approve", actor);
  const shipment = await shipLoose(order.id, [{ productId: ctx.zip.id, quantity: 100 }]);
  await changeShipment(shipment.id, "dispatch", {}, actor);
  const late = await invoice(shipment.id, { invoiceDate: "2026-06-01", paymentTermsDays: 15 });
  await changeInvoice(late.id, "issue", "", actor);

  const report = await getReceivables("2026-10-15");
  const row = report.customers.find((item) => item.customerId === ctx.customer.id);
  assert.equal(row.invoices, 1, "the settled invoice is not receivable");
  assert.equal(row.total, late.totalAmount);
  assert.equal(row.buckets["90+"], late.totalAmount);
  assert.equal((await getReceivables("2026-06-10")).customers.find((item) => item.customerId === ctx.customer.id).buckets.current, late.totalAmount);

  const overdue = await listInvoices(invoiceQuerySchema.parse({ balance: "overdue", customerId: ctx.customer.id }));
  assert.deepEqual(overdue.invoices.map((item) => item.id), [late.id]);
});

test("an item sold at two prices on one order cannot be invoiced ambiguously", async () => {
  const order = await createSalesOrder({
    customerId: ctx.customer.id, orderDate: "2026-10-15",
    lines: [
      { kind: "catalog", productId: ctx.zip.id, quantity: 10, unitPrice: 0.04, discountPercent: 0, taxPercent: 0 },
      { kind: "catalog", productId: ctx.zip.id, quantity: 10, unitPrice: 0.05, discountPercent: 0, taxPercent: 0 },
    ],
  }, actor);
  await changeSalesOrderStatus(order.id, "approve", actor);
  const shipment = await shipLoose(order.id, [{ productId: ctx.zip.id, quantity: 5 }]);
  await changeShipment(shipment.id, "dispatch", {}, actor);
  await expectCode(invoice(shipment.id), "INVOICE_PRICE_UNRESOLVED");
});

test("a non sales tax invoice bills no GST; the sales tax invoice is unchanged", async () => {
  const order = await createSalesOrder({
    customerId: ctx.customer.id, orderDate: "2026-10-15", deliveryDate: "2026-11-15",
    lines: [{ kind: "catalog", productId: ctx.zip.id, quantity: 200, unitPrice: 0.0375, discountPercent: 10, taxPercent: 18 }],
  }, actor);
  await changeSalesOrderStatus(order.id, "approve", actor);
  const shipment = await shipLoose(order.id, [{ productId: ctx.zip.id, quantity: 200 }]);
  await changeShipment(shipment.id, "dispatch", {}, actor);

  const created = await invoice(shipment.id, { invoiceType: "NON_TAX" });
  assert.equal(created.invoiceType, "NON_TAX");
  assert.deepEqual([created.subtotal, created.discountTotal, created.taxTotal, created.totalAmount], ["7.50", "0.75", "0.00", "6.75"]);
  assert.equal(Number(created.lines[0].taxPercent), 0);
  assert.equal(Number(created.lines[0].taxAmount), 0);
  const issued = await changeInvoice(created.id, "issue", "", actor);
  assert.equal(issued.outstanding, "6.75");

  const listed = await listInvoices(invoiceQuerySchema.parse({ search: issued.invoiceNumber }));
  assert.deepEqual(listed.invoices.map((row) => row.invoiceType), ["NON_TAX"]);

  assert.equal(ctx.invoice.invoiceType, "SALES_TAX", "the default stays the sales tax invoice");
  assert.throws(() => invoiceInputSchema.parse({ idempotencyKey: key(), shipmentId: shipment.id, invoiceDate: "2026-10-15", paymentTermsDays: 30, invoiceType: "ZERO" }));
});
