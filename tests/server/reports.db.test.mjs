import assert from "node:assert/strict";
import test from "node:test";

import { getSalesOrderFulfilment } from "../../server/dispatch/dispatch.service.ts";
import { addDecimalStrings, compareDecimalStrings } from "../../server/core/utils/decimal.ts";
import { REPORTS, runReport } from "../../server/reports/reports.service.ts";

const range = { from: "2000-01-01", to: "2999-12-31" };

test("every report runs against the database and returns its declared columns", async () => {
  for (const key of Object.keys(REPORTS)) {
    const result = await runReport(key, range);
    assert.equal(result.columns.length > 0, true, key);
    for (const row of result.rows) {
      for (const column of result.columns) assert.ok(column.key in row, `${key}: missing ${column.key}`);
    }
    for (const [column, total] of Object.entries(result.totals)) {
      const sum = result.rows.reduce((acc, row) => (row[column] ? addDecimalStrings(acc, row[column]) : acc), "0");
      assert.equal(compareDecimalStrings(sum, total), 0, `${key}.${column} total`);
    }
  }
});

test("the order fulfilment report agrees with the dispatch service", async () => {
  const report = await runReport("orders", range);
  const shipped = report.rows.filter((row) => Number(row.shipped) > 0).slice(0, 5);
  assert.ok(shipped.length > 0, "the test database has shipped orders");
  for (const row of shipped) {
    const fulfilment = await getSalesOrderFulfilment(row.id);
    const total = (field) => fulfilment.items.reduce((sum, item) => addDecimalStrings(sum, item[field]), "0");
    assert.equal(compareDecimalStrings(row.ordered, total("ordered")), 0, row.orderNumber);
    assert.equal(compareDecimalStrings(row.shipped, total("shipped")), 0, row.orderNumber);
    assert.equal(compareDecimalStrings(row.delivered, total("delivered")), 0, row.orderNumber);
  }
});

test("unknown reports and inverted ranges are refused", async () => {
  await assert.rejects(runReport("nope", range), (error) => error.code === "REPORT_NOT_FOUND");
  await assert.rejects(runReport("orders", { from: "2026-02-01", to: "2026-01-01" }), (error) => error.code === "REPORT_RANGE_INVALID");
});
