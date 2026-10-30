/*
 * Replaces the customers and their ledgers with the real ones from the old
 * Excel khata (D-057), after clearing the dummy transactions, safely:
 *   1. reads and checks the import file (made from Customer_Ledger_*.xlsx):
 *      every customer's lines must add up to the sheet's closing balance,
 *   2. takes a backup with pg_dump and proves it is readable,
 *   3. shows what will be removed and what will be added,
 *   4. asks you to type REPLACE,
 *   5. in ONE transaction (all of it happens, or none of it):
 *      clears every transaction (as npm run clear-transactions does),
 *      removes every customer, their old balances and old khata, and
 *      their accounting entries, then adds the customers from the file
 *      with their khata lines and one accounting entry each for what
 *      they owe (Dr Accounts receivable / Cr Owner's equity and opening
 *      balances; the reverse for an advance),
 *   6. checks every customer's balance in the database against the file.
 *
 * Kept: users, passwords, sessions, roles and permissions; items, BOMs;
 * suppliers; locations; settings; HR and payroll; chart of accounts; audit log.
 * A customer whose khata is not in PKR is added without its lines (the ERP
 * keeps PKR); the script names it.
 *
 * Usage (DATABASE_URL, or neon_DATABASE_URL, in .env.local or .env):
 *   npm run db:replace-customers -- --file=customer-ledger-import.json
 * Options: --backup=<file.dump> to use a backup you already took and checked;
 *          --confirm=REPLACE instead of typing REPLACE, where the terminal gives no keyboard input.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLEAR_SQL, CLEARED_TABLES } from "./clear-transactions.mjs";
import { confirm } from "./confirm.mjs";
import "./load-env.mjs";
import { backupDatabase, pgTool, run, stop } from "./pg-tools.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^-?\d+(\.\d{1,2})?$/;

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const cents = (value) => {
  const [whole, fraction = ""] = String(value).replace("-", "").split(".");
  const amount = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  return String(value).startsWith("-") ? -amount : amount;
};
const decimal = (amount) => `${amount < 0n ? "-" : ""}${(amount < 0n ? -amount : amount) / 100n}.${String((amount < 0n ? -amount : amount) % 100n).padStart(2, "0")}`;
const sql = (value) => (value === null || value === undefined || value === "" ? "null" : `'${String(value).replace(/'/g, "''")}'`);

/* The import file, checked: returns the customers to add with their codes and ids. */
export function readImport(data) {
  if (!data || !Array.isArray(data.customers) || data.customers.length === 0) throw new Error("The file has no customers.");
  const problems = [];
  const names = new Set();
  const customers = data.customers.map((customer, index) => {
    const label = `${index + 1}. ${customer.name}`;
    const name = String(customer.name ?? "").trim();
    if (!name) problems.push(`${label}: no name`);
    if (names.has(name.toLowerCase())) problems.push(`${label}: the name appears twice`);
    names.add(name.toLowerCase());
    if (!AMOUNT.test(String(customer.openingBalance))) problems.push(`${label}: opening balance ${customer.openingBalance} is not an amount`);
    const entries = (customer.entries ?? []).map((entry, line) => {
      const where = `${label}, sheet row ${entry.row ?? line + 1}`;
      if (!DATE.test(String(entry.date))) problems.push(`${where}: date ${entry.date} is not YYYY-MM-DD`);
      for (const side of ["debit", "credit"]) {
        if (!AMOUNT.test(String(entry[side])) || cents(entry[side]) < 0n) problems.push(`${where}: ${side} ${entry[side]} is not an amount`);
      }
      return { ...entry, lineNo: line + 1, description: String(entry.description ?? "").trim() };
    });
    const pkr = (customer.currency ?? "PKR") === "PKR";
    const balance = entries.reduce((sum, entry) => sum + cents(entry.debit) - cents(entry.credit), cents(customer.openingBalance ?? "0"));
    if (customer.closingBalance !== undefined && balance !== cents(customer.closingBalance)) {
      problems.push(`${label}: its lines add up to ${decimal(balance)}, the file says ${customer.closingBalance}`);
    }
    return {
      id: randomUUID(),
      code: `CUS-${String(index + 1).padStart(3, "0")}`,
      name,
      currency: customer.currency ?? "PKR",
      pkr,
      openingBalance: pkr ? decimal(cents(customer.openingBalance ?? "0")) : "0.00",
      entries: pkr ? entries : [],
      skippedLines: pkr ? 0 : entries.length,
      balance: pkr ? balance : 0n,
      lastDate: entries.map((entry) => entry.date).filter((date) => DATE.test(String(date))).sort().at(-1) ?? null,
    };
  });
  if (problems.length) throw new Error(`The import file has problems:\n  ${problems.join("\n  ")}`);
  return customers;
}

/* The statements that replace the customers, run in one transaction after CLEAR_SQL. */
export function replaceSql(customers, today = new Date().toISOString().slice(0, 10)) {
  const year = today.slice(0, 4);
  const statements = [
    `do $$ begin
      if (select count(*) from erp_ledger_accounts where "systemKey" in ('AR', 'OWNER_EQUITY')) <> 2 then
        raise exception 'The chart of accounts has no Accounts receivable or Owner''s equity account; open Finance once, then run this again.';
      end if;
      if not exists (select 1 from erp_users) then raise exception 'There is no user to record the accounting entries.'; end if;
    end $$`,
    `delete from erp_journal_lines where "entryId" in (select id from erp_journal_entries where "sourceType" = 'CustomerOpening')`,
    `delete from erp_journal_entries where "sourceType" = 'CustomerOpening'`,
    "delete from erp_customer_ledger_entries",
    "delete from erp_customers",
  ];
  for (const customer of customers) {
    const openingDate = customer.entries.length ? customer.entries.map((entry) => entry.date).sort()[0] : null;
    statements.push(`insert into erp_customers (id, code, name, status, "openingBalance", "openingBalanceDate", "createdAt", "updatedAt")
      values (${sql(customer.id)}, ${sql(customer.code)}, ${sql(customer.name)}, 'ACTIVE', ${customer.openingBalance}, ${cents(customer.openingBalance) !== 0n ? sql(openingDate ?? today) : "null"}, now(), now())`);
    for (let start = 0; start < customer.entries.length; start += 200) {
      const rows = customer.entries.slice(start, start + 200).map((entry) => `(gen_random_uuid(), ${sql(customer.id)}, ${entry.lineNo}, ${sql(entry.date)}, ${entry.dateMissing ? "true" : "false"},
        ${sql(entry.reference)}, ${sql(entry.poNumber)}, ${sql(entry.dcNumber)}, '${entry.description.replace(/'/g, "''")}', ${decimal(cents(entry.debit))}, ${decimal(cents(entry.credit))})`);
      statements.push(`insert into erp_customer_ledger_entries (id, "customerId", "lineNo", "entryDate", "dateMissing", reference, "poNumber", "dcNumber", description, debit, credit)
        values ${rows.join(",\n")}`);
    }
    if (customer.balance === 0n) continue;
    const amount = decimal(customer.balance < 0n ? -customer.balance : customer.balance);
    const date = customer.lastDate && customer.lastDate <= today ? customer.lastDate : today;
    const [debitAccount, creditAccount] = customer.balance > 0n ? ["AR", "OWNER_EQUITY"] : ["OWNER_EQUITY", "AR"];
    statements.push(`with seq as (
        insert into erp_document_sequences (key, "nextValue", "updatedAt") values ('JE-${year}', 2, now())
        on conflict (key) do update set "nextValue" = erp_document_sequences."nextValue" + 1, "updatedAt" = now()
        returning "nextValue" - 1 as n
      ), entry as (
        insert into erp_journal_entries (id, "entryNumber", "entryDate", description, "sourceType", "sourceId", "sourceEvent", status, "totalAmount", "idempotencyKey", "createdBy")
        select gen_random_uuid(), 'JE-${year}-' || lpad(n::text, 6, '0'), ${sql(date)}, ${sql(`Customer old khata imported: ${customer.name} ${customer.balance > 0n ? "owes" : "paid in advance"} ${amount}`)},
          'CustomerOpening', ${sql(customer.id)}, 'IMPORT', 'POSTED', ${amount}, ${sql(`je:CustomerOpening:${customer.id}:IMPORT`)},
          (select id from erp_users order by "createdAt" limit 1)
        from seq returning id
      )
      insert into erp_journal_lines (id, "entryId", "lineNo", "accountId", debit, credit, memo)
      select gen_random_uuid(), entry.id, 1, (select id from erp_ledger_accounts where "systemKey" = '${debitAccount}'), ${amount}, 0, null from entry
      union all
      select gen_random_uuid(), entry.id, 2, (select id from erp_ledger_accounts where "systemKey" = '${creditAccount}'), 0, ${amount}, null from entry`);
  }
  return statements;
}

async function main() {
  const url = process.env.neon_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) stop("DATABASE_URL is not set. Put it in .env.local (or .env) and run: npm run db:replace-customers -- --file=customer-ledger-import.json");
  const file = option("file");
  if (!file) stop("Name the import file: npm run db:replace-customers -- --file=customer-ledger-import.json");
  if (!existsSync(file)) stop(`${file} was not found. Put it in this folder (D:\\apparel-fasteners-erp) and run again.`);

  let customers;
  try {
    customers = readImport(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    stop(`${file}: ${error.message}`);
  }
  const lines = customers.reduce((sum, customer) => sum + customer.entries.length, 0);
  const owed = customers.reduce((sum, customer) => sum + customer.balance, 0n);
  console.log(`Import file ${file}: ${customers.length} customers, ${lines} khata lines, balances add up.`);
  console.log(`  Total they owe: PKR ${decimal(owed)}`);
  for (const customer of customers.filter((item) => !item.pkr)) {
    console.log(`  ! ${customer.name}: khata in ${customer.currency}; the customer is added, its ${customer.skippedLines} lines are not (the ERP keeps PKR).`);
  }

  let host = "?";
  let database = "?";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "");
  } catch {
    stop("DATABASE_URL is not a valid connection string.");
  }
  console.log(`\nTarget database: ${database} on ${host}`);

  const backup = backupDatabase(url, database, option("backup"));
  const psql = pgTool("psql");

  const counting = [...CLEARED_TABLES, "erp_customers", "erp_customer_ledger_entries"]
    .map((table) => `select '${table}' as t, count(*) from ${table}`).join(" union all ")
    + ` union all select 'accounting entries (not payroll)', count(*) from erp_journal_entries where "sourceType" is null or "sourceType" not in ('PayrollRun', 'SalaryAdvance')`
    + " order by 1";
  const counts = run("Counting what will be removed", psql, ["--no-psqlrc", "-At", "-F", " ", "-v", "ON_ERROR_STOP=1", "-c", counting, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  for (const line of counts) {
    const count = Number(line.split(" ").at(-1));
    if (count > 0) console.log(`  ${String(count).padStart(8)}  ${line.slice(0, line.lastIndexOf(" "))}`);
  }
  console.log(`\nAdded: ${customers.length} customers (codes CUS-001 to CUS-${String(customers.length).padStart(3, "0")}), ${lines} khata lines, PKR ${decimal(owed)} receivable.`);
  console.log("Kept: users, passwords, roles; items, BOMs; suppliers; locations; settings; HR and payroll; chart of accounts; audit log.");

  const decision = await confirm(`Remove the rows above from "${database}" on ${host} and add the customers from ${file}? This cannot be undone except from ${backup}.`, "REPLACE");
  if (decision === "no-input") {
    stop(`No keyboard input reached the script. After reading the list above, run it again with --confirm=REPLACE:
  npm run db:replace-customers -- --file=${file} --backup=${backup} --confirm=REPLACE`);
  }
  if (decision !== "confirmed") stop("Not confirmed. Nothing was changed.");

  // One transaction: everything is replaced, or nothing is.
  const folder = mkdtempSync(join(tmpdir(), "af7-replace-"));
  const script = join(folder, "replace.sql");
  try {
    writeFileSync(script, [...CLEAR_SQL, ...replaceSql(customers)].map((statement) => `${statement};`).join("\n\n"));
    run("Replacing the customers (one transaction)", psql, ["--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", script, url]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }

  // Every customer's balance as the database now has it, against the file.
  const check = run("Checking every customer's balance", psql, ["--no-psqlrc", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c",
    `select c.code, (c."openingBalance" + coalesce(sum(e.debit - e.credit), 0))::text from erp_customers c
     left join erp_customer_ledger_entries e on e."customerId" = c.id group by c.id order by c.code`, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  const wrong = customers.filter((customer) => {
    const row = check.find((line) => line.startsWith(`${customer.code}|`));
    return !row || cents(Number(row.split("|")[1]).toFixed(2)) !== customer.balance;
  });
  if (check.length !== customers.length || wrong.length) {
    stop(`The database does not match the file for: ${wrong.map((customer) => customer.name).join(", ") || `${check.length} customers instead of ${customers.length}`}. Restore ${backup} and send this output.`);
  }
  console.log(`\n✔ Done. ${customers.length} customers and ${lines} khata lines; every balance matches the file. Keep ${backup} until you have checked the app.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("replace-customers.mjs")) {
  await main();
  process.exit(0);
}
