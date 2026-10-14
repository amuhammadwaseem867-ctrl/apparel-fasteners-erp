import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DATABASE_SCHEMA_OUTDATED,
  getSchemaMismatch,
} from "../../server/core/errors/database-errors.ts";
import {
  formatAmount,
  formatCount,
  toDashboardView,
} from "../../lib/dashboard/dashboardView.js";

function sqlQueryError(sqlState, extra = {}) {
  return Object.assign(new Error("query failed"), {
    kind: "sql_query",
    sqlState,
    ...extra,
  });
}

test("missing tables or columns are classified as an outdated database schema", () => {
  for (const sqlState of ["42P01", "42703"]) {
    const mismatch = getSchemaMismatch(
      sqlQueryError(sqlState, { table: "erp_sales_order_lines", column: "productId" }),
    );

    assert.equal(mismatch?.sqlState, sqlState);
    assert.equal(mismatch?.column, "productId");
  }

  const wrapped = new Error("outer", { cause: sqlQueryError("42703") });
  assert.equal(getSchemaMismatch(wrapped)?.sqlState, "42703");

  assert.equal(DATABASE_SCHEMA_OUTDATED.status, 503);
  assert.equal(DATABASE_SCHEMA_OUTDATED.code, "DATABASE_SCHEMA_OUTDATED");
  assert.match(DATABASE_SCHEMA_OUTDATED.message, /apply the pending database migration/);
  assert.doesNotMatch(DATABASE_SCHEMA_OUTDATED.message, /erp_|productId/);
});

test("other database errors are not reported as a schema problem", () => {
  assert.equal(getSchemaMismatch(sqlQueryError("23505")), null);
  assert.equal(getSchemaMismatch(sqlQueryError(undefined)), null);
  assert.equal(getSchemaMismatch(new Error("connection reset")), null);
  assert.equal(getSchemaMismatch("not an error"), null);
});

test("dashboard view uses API values and never substitutes zeros for missing KPIs", () => {
  const view = toDashboardView({
    period: { key: "30d", dateFrom: "2026-09-15", dateTo: "2026-10-14" },
    kpis: {
      totalOrders: 3,
      approvedSales: 1250.5,
      draftSales: 99.999,
      activeCustomers: 4,
    },
    orderStatus: [{ status: "APPROVED", count: 2, amount: 1250.5 }],
    recentOrders: [{ id: "o1", orderNumber: "SO-1" }],
    activity: [],
    modules: { sales: true, inventory: false, production: false },
  });

  assert.equal(view.kpis.totalOrders, 3);
  assert.equal(view.kpis.cancelledSales, null);
  assert.equal(formatCount(view.kpis.cancelledOrders), "—");
  assert.equal(formatAmount(view.kpis.approvedSales), "1,250.50");
  assert.equal(formatAmount(view.kpis.draftSales), "100.00");
  assert.equal("totalSales" in view.kpis, false, "totalSales mixes cancelled value and is not shown");
  assert.deepEqual(view.unavailableModules, ["Inventory", "Production"]);
  assert.equal(view.isEmpty, false);
});

test("dashboard view reports an empty period only when the API returned real zero data", () => {
  assert.equal(
    toDashboardView({ kpis: { totalOrders: 0 }, recentOrders: [], activity: [] }).isEmpty,
    true,
  );
  assert.equal(toDashboardView({ kpis: {} }).isEmpty, false);
  assert.equal(toDashboardView(null).kpis.totalOrders, null);
});

test("inventory pages do not fabricate records or success messages without a backend", () => {
  const root = join(import.meta.dirname, "../../app/(erp)/inventory");
  const pages = readdirSync(root, { recursive: true })
    .filter((file) => String(file).endsWith(".jsx"))
    .map((file) => join(root, String(file)));

  assert.ok(pages.length > 0);

  for (const page of pages) {
    const source = readFileSync(page, "utf8");

    assert.doesNotMatch(source, /toast\.success/, `${page} reports success without a server response`);
    assert.doesNotMatch(source, /id: `[a-z]+-\$\{Date\.now\(\)\}`/, `${page} creates client-only records`);
  }
});
