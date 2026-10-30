/*
 * Clears every transaction so AF7 starts clean (D-048), safely, in order:
 *   1. takes a backup with pg_dump and proves it is readable,
 *   2. shows how many rows each table to be cleared holds, and what is kept,
 *   3. asks you to type CLEAR,
 *   4. clears them in ONE transaction: all of it happens, or none of it.
 *
 * Cleared: orders, invoices, payments, credit notes, production, QC, NCR /
 * CAPA, packing, shipments, gate passes, stock (documents, movements,
 * balances, reservations, lots), planning / MRP, purchasing (requisitions,
 * RFQs, purchase orders, goods received, supplier bills and payments), cash
 * book and their accounting entries. Their number counters are reset, so the
 * first order is AF7-YY-0001 again.
 *
 * Kept: users, passwords, sessions, roles and permissions; customers and their old khata;
 * items, categories, BOMs; suppliers; warehouses and locations; settings;
 * HR and payroll (employees, attendance, leave, advances, payroll runs and
 * their accounting entries); the chart of accounts; the audit log.
 *
 * Usage (DATABASE_URL in .env.local or .env):
 *   npm run clear-transactions
 * Options: --backup=<file.dump> to use a backup you already took and checked;
 *          --confirm=CLEAR instead of typing CLEAR, where the terminal gives no keyboard input.
 */

import { confirm } from "./confirm.mjs";
import "./load-env.mjs";
import { backupDatabase, pgTool, run, stop } from "./pg-tools.mjs";

/* Emptied together; Postgres refuses (and nothing is cleared) if a kept table still points at one. */
export const CLEARED_TABLES = [
  "erp_sales_orders", "erp_sales_order_lines", "erp_sales_order_notes", "erp_shortfalls",
  "erp_invoices", "erp_invoice_lines", "erp_credit_notes", "erp_credit_note_lines", "erp_customer_receipts",
  "erp_production_orders", "erp_production_stages", "erp_production_stage_runs", "erp_production_stage_checks", "erp_production_events",
  "erp_production_plans", "erp_production_plan_lines",
  "erp_mrp_runs", "erp_mrp_demands", "erp_mrp_requirements", "erp_mrp_planned_orders",
  "erp_quality_inspections", "erp_ncrs", "erp_capas",
  "erp_packing_lists", "erp_packing_packages",
  "erp_shipments", "erp_shipment_lines", "erp_gate_passes", "erp_gate_pass_lines",
  "erp_stock_documents", "erp_stock_movements", "erp_stock_balances", "erp_stock_reservations", "erp_batches",
  "erp_purchase_requisitions", "erp_purchase_requisition_lines", "erp_rfqs", "erp_rfq_lines", "erp_rfq_quotes", "erp_rfq_quote_lines",
  "erp_purchase_orders", "erp_purchase_order_lines", "erp_purchase_receipts", "erp_purchase_receipt_lines",
  "erp_supplier_bills", "erp_supplier_bill_lines", "erp_supplier_payments",
  "erp_cash_transactions",
];

/* Accounting entries and number counters that belong to what is kept. */
export const KEPT_JOURNAL_SOURCES = ["PayrollRun", "SalaryAdvance", "CustomerOpening"];
export const KEPT_COUNTERS = ["ADV", "PAY", "LV", "JE"];

const quoted = (values) => values.map((value) => `'${value}'`).join(", ");
const journalKept = `"sourceType" in (${quoted(KEPT_JOURNAL_SOURCES)})`;
const counterKept = KEPT_COUNTERS.map((prefix) => `key like '${prefix}-%'`).join(" or ");

export const CLEAR_SQL = [
  `truncate table ${CLEARED_TABLES.join(", ")}`,
  `delete from erp_journal_lines where "entryId" in (select id from erp_journal_entries where "sourceType" is null or not (${journalKept}))`,
  `delete from erp_journal_entries where "sourceType" is null or not (${journalKept})`,
  `delete from erp_document_sequences where not (${counterKept})`,
];

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) stop("DATABASE_URL is not set. Put it in .env.local (or .env) and run: npm run clear-transactions");
  let host = "?";
  let database = "?";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "");
  } catch {
    stop("DATABASE_URL is not a valid connection string.");
  }
  console.log(`Target database: ${database} on ${host}`);

  // 1. Backup first.
  const backup = backupDatabase(url, database, option("backup"));
  const psql = pgTool("psql");

  // 2. What will be cleared.
  const counting = CLEARED_TABLES.map((table) => `select '${table}' as t, count(*) from ${table}`).join(" union all ")
    + ` union all select 'accounting entries (not payroll)', count(*) from erp_journal_entries where "sourceType" is null or not (${journalKept})`
    + " order by 1";
  const counts = run("Counting what will be cleared", psql, ["--no-psqlrc", "-At", "-F", " ", "-v", "ON_ERROR_STOP=1", "-c", counting, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  let total = 0;
  for (const line of counts) {
    const count = Number(line.split(" ").at(-1));
    total += count;
    if (count > 0) console.log(`  ${String(count).padStart(8)}  ${line.slice(0, line.lastIndexOf(" "))}`);
  }
  console.log(`  ${String(total).padStart(8)}  rows in all`);
  console.log("\nKept: users, passwords, roles; customers; items, BOMs; suppliers; locations; settings; HR and payroll; chart of accounts; audit log.");

  const decision = await confirm(`Clear these transactions from "${database}" on ${host}? This cannot be undone except from ${backup}.`, "CLEAR");
  if (decision === "no-input") {
    stop(`No keyboard input reached the script. After reading the list above, run it again with --confirm=CLEAR:
  npm run clear-transactions -- --backup=${backup} --confirm=CLEAR`);
  }
  if (decision !== "confirmed") stop("Not confirmed. Nothing was cleared.");

  // 3. One transaction: everything is cleared, or nothing is.
  run("Clearing the transactions (one transaction)", psql, [
    "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "--single-transaction",
    ...CLEAR_SQL.flatMap((sql) => ["-c", sql]),
    url,
  ]);

  console.log(`\n✔ Done. The next order will be AF7-YY-0001. Keep ${backup} until you have checked the app.`);
  console.log("Next: enter your opening stock with Inventory → Raw material stock → Receive material.");
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("clear-transactions.mjs")) {
  await main();
  process.exit(0);
}
