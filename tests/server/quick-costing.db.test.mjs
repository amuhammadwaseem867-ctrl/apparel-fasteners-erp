/*
 * D-059: quick costing only calculates. It gives the same costing as the
 * engine for the same lines, and makes no order, invoice, stock or
 * accounting entry.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { DEFAULT_COSTING_RATES, costOrder } from "../../server/costing/costing-rules.ts";
import { getCostingRates, getQuickCosting } from "../../server/costing/costing.service.ts";

const counts = async () => {
  const [row] = await db.runtime().query(db.raw.sql`
    select (select count(*) from erp_sales_orders)::text as orders, (select count(*) from erp_invoices)::text as invoices,
      (select count(*) from erp_journal_entries)::text as journal, (select count(*) from erp_stock_documents)::text as stock,
      (select count(*) from erp_audit_logs)::text as audit
  `.returnsRow({ orders: "pg/text@1", invoices: "pg/text@1", journal: "pg/text@1", stock: "pg/text@1", audit: "pg/text@1" }).build());
  return row;
};

test("quick costing calculates like an order's costing and writes nothing", async () => {
  const before = await counts();
  const result = await getQuickCosting({
    customerName: "Walk-in", reference: "Q-1", date: "2026-11-16",
    lines: [
      { productName: "#5 Metal Zipper Open End", size: "20 Inch", finish: "Antique Brass", quantity: 500, unitPrice: 40 },
      { productName: "#4.5 Metal Zipper Close End", size: "14 cm", finish: "Shiny Nickel", quantity: 2000, unitPrice: 12 },
      { productName: "Packing tape", size: "", finish: "", quantity: 3 },
    ],
  });
  const rates = await getCostingRates();
  const expected = costOrder([
    { lineNo: 1, productName: "#5 Metal Zipper Open End", size: "20 Inch", finish: "Antique Brass", quantity: 500 },
    { lineNo: 2, productName: "#4.5 Metal Zipper Close End", size: "14 cm", finish: "Shiny Nickel", quantity: 2000 },
    { lineNo: 3, productName: "Packing tape", size: null, finish: null, quantity: 3 },
  ], rates, 500 * 40 + 2000 * 12);
  assert.equal(result.quick, true);
  assert.deepEqual(result.totals, expected.totals);
  assert.deepEqual(result.skipped.map((row) => row.lineNo), [3]);
  assert.equal(result.order.orderNumber, "Q-1");
  assert.equal(result.totals.revenue, 44000);
  assert.deepEqual(await counts(), before, "no order, invoice, stock, accounting or audit row");
  assert.ok(DEFAULT_COSTING_RATES.gauges.length > 0);
});

test("quick costing refuses lines without an item or quantity", async () => {
  await assert.rejects(getQuickCosting({ date: "2026-11-16", lines: [] }), (error) => error.code === "VALIDATION_FAILED");
  await assert.rejects(getQuickCosting({ date: "2026-11-16", lines: [{ productName: "#5 Metal Zipper", size: "7 Inch", quantity: 0 }] }), (error) => error.code === "VALIDATION_FAILED");
});

test("rates saved before 2-way zippers get the default 2-way pin box rate; a saved one is kept", async () => {
  const { setCostingRates } = await import("../../server/costing/costing.service.ts");
  const actor = (await import("node:crypto")).randomUUID();
  const old = { ...DEFAULT_COSTING_RATES, gauges: DEFAULT_COSTING_RATES.gauges.map(({ twoWayPinBoxSetPerPc, ...rest }) => rest) };
  try {
    const saved = await setCostingRates(old, actor);
    assert.deepEqual(saved.gauges.map((gauge) => gauge.twoWayPinBoxSetPerPc), [2.0969, 2.0969]);
    const changed = await setCostingRates({ ...DEFAULT_COSTING_RATES, gauges: DEFAULT_COSTING_RATES.gauges.map((gauge) => ({ ...gauge, twoWayPinBoxSetPerPc: 3.5 })) }, actor);
    assert.deepEqual(changed.gauges.map((gauge) => gauge.twoWayPinBoxSetPerPc), [3.5, 3.5]);
  } finally {
    await db.runtime().query(db.raw.sql`delete from erp_app_settings where key = 'costing.rates' returning key`.returnsRow({ key: "pg/text@1" }).build());
  }
});

test("costing history (D-060): a saved quick costing is listed, prints its snapshot, and can be deleted; invoices are saved once", async () => {
  const service = await import("../../server/costing/costing.service.ts");
  const { randomUUID } = await import("node:crypto");
  const actor = randomUUID();
  const ref = `QH-${Date.now()}`;
  const before = await counts();
  const saved = await service.saveQuickCosting({
    customerName: "History test", reference: ref, date: "2026-11-18",
    lines: [{ productName: "#5 Metal Zipper Close End", size: "7 Inch", finish: "Antique Brass", quantity: 1000, unitPrice: 25 }],
  }, actor);
  assert.match(saved.recordNumber, /^QC-\d{4}-\d{6}$/);
  assert.equal(saved.data.recordNumber, saved.recordNumber, "the printout carries the costing number");
  assert.equal(Number(saved.revenue), 25000);
  const after = await counts();
  assert.deepEqual([after.orders, after.invoices, after.journal, after.stock], [before.orders, before.invoices, before.journal, before.stock], "still no order, invoice, stock or accounting entry");
  const list = await service.listCostingRecords({ search: ref });
  assert.deepEqual(list.records.map((row) => row.recordNumber), [saved.recordNumber]);
  assert.equal(list.totals.count, "1");

  const invoice = (amount) => ({ invoices: [{ number: `INV-${ref}`, date: "2026-11-01", customerName: "Inv test", lines: [
    { productName: "#5 Metal Zipper Open End with Customer Slider", size: "20 Inch", finish: "Antique Brass", unit: "Pcs", quantity: 100, amount },
    { productName: "#5 Tape White", size: "", unit: "KG", quantity: 10, amount: 11000 },
  ] }] });
  const first = await service.importInvoiceCostings(invoice(5000), actor);
  const again = await service.importInvoiceCostings(invoice(6000), actor);
  assert.equal(again.saved[0].recordNumber, first.saved[0].recordNumber, "saving an invoice again replaces it, same number");
  const rows = await service.listCostingRecords({ search: `INV-${ref}` });
  assert.equal(rows.records.length, 1);
  assert.deepEqual([rows.records[0].revenue, rows.records[0].notCostedRevenue], ["6000.00", "11000.00"], "tape is kept apart from the profit");
  const record = await service.getCostingRecord(rows.records[0].id);
  assert.equal(record.data.invoice, true);
  assert.equal(record.data.recordNumber, first.saved[0].recordNumber);
  await assert.rejects(service.deleteCostingRecord(record.id, actor), (error) => error.code === "COSTING_NOT_DELETABLE");

  await service.deleteCostingRecord(saved.id, actor);
  await assert.rejects(service.getCostingRecord(saved.id), (error) => error.code === "COSTING_NOT_FOUND");
});

test("recalculating invoice costings (D-061) uses the current rates and keeps numbers and customers", async () => {
  const service = await import("../../server/costing/costing.service.ts");
  const { randomUUID } = await import("node:crypto");
  const actor = randomUUID();
  const ref = `RC-${Date.now()}`;
  const withDyeing = { ...DEFAULT_COSTING_RATES, gauges: DEFAULT_COSTING_RATES.gauges.map((gauge) => ({ ...gauge, dyeingPerMeter: 5, platingPerMeter: 4 })) };
  try {
    await service.setCostingRates(withDyeing, actor);
    const [saved] = (await service.importInvoiceCostings({ invoices: [{ number: ref, date: "2026-11-02", customerName: "Recalc test", lines: [
      { productName: "#5 Metal Zipper Close End", size: "7 Inch", finish: "Antique Brass", unit: "Pcs", quantity: 1000, amount: 25000 },
    ] }] }, actor)).saved;
    const before = (await service.listCostingRecords({ search: ref })).records[0];
    const printed = await service.getCostingRecord(before.id);
    assert.ok(printed.data.sections[0].items.some((item) => item.key === "dyeing"));

    await service.setCostingRates(DEFAULT_COSTING_RATES, actor);
    let step = { next: 0, done: false };
    while (!step.done) step = await service.recalculateInvoiceCostings({ offset: step.next, limit: 50 }, actor);

    const after = (await service.listCostingRecords({ search: ref })).records[0];
    assert.equal(after.recordNumber, saved.recordNumber);
    assert.equal(after.customerName, "Recalc test");
    assert.ok(Number(after.materialCost) < Number(before.materialCost), "dyeing and plating no longer charged");
    assert.equal(Number(after.revenue), 25000);
    const reprinted = await service.getCostingRecord(after.id);
    assert.ok(!reprinted.data.sections[0].items.some((item) => item.key === "dyeing" || item.key === "plating"));
    assert.equal(reprinted.data.recordNumber, saved.recordNumber);
  } finally {
    await db.runtime().query(db.raw.sql`delete from erp_app_settings where key = 'costing.rates' returning key`.returnsRow({ key: "pg/text@1" }).build());
  }
});
