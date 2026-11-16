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
