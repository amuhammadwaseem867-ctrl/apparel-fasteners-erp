import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { changeInvoice, createManualInvoice, getInvoice, updateManualInvoice } from "../../server/finance/finance.service.ts";
import { manualInvoiceSchema } from "../../server/finance/finance.validation.ts";
import { createCustomer, getSalesOrder } from "../../server/sales/sales.service.ts";
import { formatOrderNumber } from "../../lib/orders/orderNumber.js";

const run = `IF${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const lines = [
  { product: "#5 Metal Zipper Open End", finish: "Antique Brass", teethType: "Plain Teeth", tapeColor: "Black", size: "24 Inch", unit: "Pcs", quantity: 1000, unitPrice: 42 },
  { product: "#3 Nylon Zipper Close End", finish: "Shiny Silver", tapeColor: "Navy", size: "7 Inch", unit: "Pcs", quantity: 500, unitPrice: 10.5 },
];
const invoice = (extra = {}, sheet = {}) => createManualInvoice(manualInvoiceSchema.parse({
  idempotencyKey: randomUUID(), paymentTermsDays: 30, ...extra,
  sheet: { customerId: ctx.customer.id, customerPo: `PO-${run}`, orderDate: "2026-10-20", lines, ...sheet },
}), actor);

test.before(async () => {
  ctx.customer = await createCustomer({ code: `IF-${run}`, name: `Invoice first ${run}` }, actor);
});

test("order numbers are AF7-<year>-<serial>; only the year part changes", () => {
  assert.equal(formatOrderNumber("2026-10-20", 1), "AF7-26-0001");
  assert.equal(formatOrderNumber("2026-12-31", 154), "AF7-26-0154");
  assert.equal(formatOrderNumber("2027-01-02", 155), "AF7-27-0155");
});

test("a manual invoice makes the draft order and invoice under one number, at 18% sales tax", async () => {
  const created = await invoice();
  assert.match(created.invoiceNumber, /^AF7-26-\d{4}$/);
  assert.equal(created.status, "DRAFT");
  assert.equal(created.shipmentId, null);
  assert.equal(created.salesOrderNumber, created.invoiceNumber, "one number for the invoice and the order");
  assert.deepEqual(created.lines.map((line) => [line.quantity, line.unitPrice, line.taxPercent]), [["1000", "42", 18], ["500", "10.5", 18]]);
  // 42000 + 5250 = 47250; GST 18% = 8505; total 55755.
  assert.deepEqual([created.subtotal, created.taxTotal, created.totalAmount], ["47250.00", "8505.00", "55755.00"]);
  const order = await getSalesOrder(created.salesOrderId);
  assert.equal(order.status, "DRAFT");
  assert.equal(order.orderNumber, created.invoiceNumber);
  assert.deepEqual(order.lines.map((line) => [line.tapeColor, line.finish, line.size]), [["Black", "Antique Brass", "24 Inch"], ["Navy", "Shiny Silver", "7 Inch"]]);

  const next = await invoice({ invoiceType: "NON_TAX" });
  const serial = (number) => Number(number.slice(-4));
  assert.equal(serial(next.invoiceNumber), serial(created.invoiceNumber) + 1, "the next order takes the next serial");
  assert.deepEqual([next.taxTotal, next.totalAmount], ["0.00", "47250.00"], "non sales tax: no GST");
  ctx.first = created;
  ctx.second = next;
});

test("approving the invoice confirms the order; cancelling a draft cancels it", async () => {
  const issued = await changeInvoice(ctx.first.id, "issue", "", actor);
  assert.equal(issued.status, "ISSUED");
  assert.equal((await getSalesOrder(ctx.first.salesOrderId)).status, "APPROVED", "the order goes to Orders, ready for production");

  await changeInvoice(ctx.second.id, "cancel", "Customer changed the order", actor);
  assert.equal((await getSalesOrder(ctx.second.salesOrderId)).status, "CANCELLED");
});

test("a 2027 invoice changes only the year; the serial runs on; every line needs a rate", async () => {
  const before = await invoice();
  const later = await invoice({}, { orderDate: "2027-01-05" });
  assert.match(later.invoiceNumber, /^AF7-27-\d{4}$/);
  assert.equal(Number(later.invoiceNumber.slice(-4)), Number(before.invoiceNumber.slice(-4)) + 1, "the count does not restart");
  assert.equal(later.dueDate, "2027-02-04");
  assert.equal(manualInvoiceSchema.safeParse({
    idempotencyKey: randomUUID(), sheet: { customerId: ctx.customer.id, orderDate: "2026-10-20", lines: [{ ...lines[0], unitPrice: 0 }] },
  }).success, false);
  assert.equal((await getInvoice(later.id)).invoiceNumber, later.invoiceNumber);
});

test("a draft invoice is edited together with its order sheet; an approved one is not", async () => {
  const draft = await invoice();
  const edited = await updateManualInvoice(draft.id, manualInvoiceSchema.parse({
    idempotencyKey: randomUUID(), invoiceType: "NON_TAX", paymentTermsDays: 15,
    sheet: { customerId: ctx.customer.id, orderDate: "2026-10-21", lines: [{ ...lines[0], quantity: 2000 }] },
  }), actor);
  assert.equal(edited.invoiceNumber, draft.invoiceNumber, "the number stays");
  assert.deepEqual([edited.lines.length, edited.lines[0].quantity, edited.totalAmount, edited.dueDate], [1, "2000", "84000.00", "2026-11-05"]);
  const order = await getSalesOrder(draft.salesOrderId);
  assert.deepEqual([order.lines.length, String(order.lines[0].quantity), order.orderDate], [1, "2000", "2026-10-21"]);

  await changeInvoice(draft.id, "issue", "", actor);
  await assert.rejects(updateManualInvoice(draft.id, manualInvoiceSchema.parse({ idempotencyKey: randomUUID(), sheet: { customerId: ctx.customer.id, orderDate: "2026-10-21", lines } }), actor), (error) => error.code === "INVOICE_STATUS_CONFLICT");
});

test("production for an approved invoice carries the order's number", async () => {
  const { sendOrderToProduction } = await import("../../server/sales/order-trace.service.ts");
  const fresh = await invoice();
  await changeInvoice(fresh.id, "issue", "", actor);
  const trace = await sendOrderToProduction(fresh.salesOrderId, actor);
  assert.deepEqual(trace.production.map((item) => item.orderNumber).sort(), [`${fresh.invoiceNumber}-1`, `${fresh.invoiceNumber}-2`]);
});
