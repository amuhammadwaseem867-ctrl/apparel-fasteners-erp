import assert from "node:assert/strict";
import test from "node:test";

import { CLEAR_SQL, CLEARED_TABLES, KEPT_COUNTERS, KEPT_JOURNAL_SOURCES } from "../../scripts/clear-transactions.mjs";

test("the clean-up never touches logins, customers, items, settings or HR / payroll (D-048)", () => {
  const kept = [
    "erp_users", "erp_user_sessions", "erp_user_roles", "erp_roles", "erp_permissions", "erp_role_permissions", "erp_login_attempt_counters",
    "erp_customers", "erp_products", "erp_product_categories", "erp_boms", "erp_bom_lines", "erp_suppliers",
    "erp_warehouses", "erp_storage_locations", "erp_app_settings", "erp_audit_logs", "erp_ledger_accounts",
    "erp_employees", "erp_departments", "erp_attendance_records", "erp_salary_advances", "erp_payroll_runs", "erp_payroll_lines", "erp_leave_requests",
  ];
  for (const table of kept) assert.ok(!CLEARED_TABLES.includes(table), `${table} must be kept`);
  for (const table of ["erp_sales_orders", "erp_invoices", "erp_customer_receipts", "erp_stock_movements", "erp_stock_balances", "erp_packing_lists", "erp_shipments"]) {
    assert.ok(CLEARED_TABLES.includes(table), `${table} is a transaction`);
  }
  assert.deepEqual(KEPT_JOURNAL_SOURCES, ["PayrollRun", "SalaryAdvance", "CustomerOpening"]);
  assert.ok(KEPT_COUNTERS.includes("PAY") && KEPT_COUNTERS.includes("JE"));
  assert.ok(CLEAR_SQL.every((sql) => !/\bdrop\b|erp_users|erp_customers|erp_products/i.test(sql)), "no drops; kept tables are never named");
});
