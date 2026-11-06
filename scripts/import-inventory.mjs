/*
 * Replaces the stock with the current balances from AF7's inventory sheet
 * (D-058), safely:
 *   1. reads and checks the import file (made from the inventory workbook:
 *      every item's latest month only, with its location, unit weight and rate),
 *   2. takes a backup with pg_dump and proves it is readable,
 *   3. shows what will be removed and what will be added,
 *   4. asks you to type IMPORT,
 *   5. in ONE transaction (all of it happens, or none of it):
 *      removes all stock (balances, movements, stock documents, reservations,
 *      batches), adds the sheet's items to the item list or updates the ones
 *      already there (unit weight, rate, unit), and puts each balance into its
 *      location with one opening stock document (Stock In),
 *   6. checks every item's stock in the database against the file.
 *
 * Kept: the item list (items not in the sheet stay, with no stock), BOMs,
 * customers, orders, invoices, users, settings. Run npm run db:replace-customers
 * first when the old orders and invoices are dummy too.
 *
 * Usage (DATABASE_URL in .env.local or .env):
 *   npm run db:import-inventory -- --file=inventory-import.json
 * Options: --backup=<file.dump> to use a backup you already took and checked;
 *          --confirm=IMPORT instead of typing IMPORT, where the terminal gives no keyboard input.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { confirm } from "./confirm.mjs";
import "./load-env.mjs";
import { backupDatabase, pgTool, run, stop } from "./pg-tools.mjs";

import { STOCK_TABLES, importSql, locationCodeFor, readImport, sql, withListedItems } from "./inventory-plan.mjs";

export { STOCK_TABLES, importSql, listedSku, locationCodeFor, readImport, skuFor, withListedItems } from "./inventory-plan.mjs";

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const url = process.env.neon_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) stop("DATABASE_URL is not set. Put it in .env.local (or .env) and run: npm run db:import-inventory -- --file=inventory-import.json");
  const file = option("file");
  if (!file) stop("Name the import file: npm run db:import-inventory -- --file=inventory-import.json");
  if (!existsSync(file)) stop(`${file} was not found. Put it in this folder (D:\\apparel-fasteners-erp) and run again.`);

  let plan;
  try {
    plan = readImport(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    stop(`${file}: ${error.message}`);
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
  console.log(`Target database: ${database} on ${host}`);
  const psql = pgTool("psql");
  const listed = JSON.parse(run("Reading the item list", psql, ["--no-psqlrc", "-At", "-v", "ON_ERROR_STOP=1", "-c",
    `select coalesce(json_agg(json_build_object('sku', sku, 'category', category, 'size', size, 'itemType', "itemType", 'finish', finish, 'variant', variant, 'logoType', "logoType")), '[]') from erp_products where status <> 'ARCHIVED'`,
    url], { capture: true, quiet: true }).trim() || "[]");
  plan = withListedItems(plan, listed);

  const byUnit = {};
  for (const balance of plan.balances) {
    const unit = plan.products.find((product) => product.sku === balance.sku).unit;
    byUnit[unit] = Number(((byUnit[unit] ?? 0) + balance.quantity).toFixed(3));
  }
  console.log(`\nImport file ${file}: ${plan.products.length} items (${plan.matched} rows matched to the raw material list), ${plan.balances.length} balances in ${new Set(plan.balances.map((balance) => locationCodeFor(balance.location))).size} locations.`);
  console.log(`  Stock: ${Object.entries(byUnit).map(([unit, total]) => `${total.toLocaleString("en-US")} ${unit}`).join(", ")}`);

  const backup = backupDatabase(url, database, option("backup"));

  const skus = plan.products.map((product) => sql(product.sku)).join(", ");
  const counting = STOCK_TABLES.map((table) => `select '${table}' as t, count(*) from ${table}`).join(" union all ")
    + ` union all select 'items already in the list (updated)', count(*) from erp_products where sku in (${skus})`
    + " order by 1";
  const counts = run("Counting what will change", psql, ["--no-psqlrc", "-At", "-F", " ", "-v", "ON_ERROR_STOP=1", "-c", counting, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  let existing = 0;
  for (const line of counts) {
    const count = Number(line.split(" ").at(-1));
    const label = line.slice(0, line.lastIndexOf(" "));
    if (label.startsWith("items already")) existing = count;
    else if (count > 0) console.log(`  ${String(count).padStart(8)}  ${label} (removed)`);
  }
  console.log(`\nItems: ${existing} updated, ${plan.products.length - existing} added. Items not in the sheet stay, with no stock.`);
  console.log("Kept: the item list, BOMs, customers, orders, invoices, users, settings.");

  const decision = await confirm(`Replace the stock in "${database}" on ${host} with ${file}? This cannot be undone except from ${backup}.`, "IMPORT");
  if (decision === "no-input") {
    stop(`No keyboard input reached the script. After reading the list above, run it again with --confirm=IMPORT:
  npm run db:import-inventory -- --file=${file} --backup=${backup} --confirm=IMPORT`);
  }
  if (decision !== "confirmed") stop("Not confirmed. Nothing was changed.");

  const folder = mkdtempSync(join(tmpdir(), "af7-inventory-"));
  const script = join(folder, "import.sql");
  try {
    writeFileSync(script, importSql(plan).map((statement) => `${statement};`).join("\n\n"));
    run("Replacing the stock (one transaction)", psql, ["--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", script, url]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }

  const check = run("Checking every item's stock", psql, ["--no-psqlrc", "-At", "-F", "|", "-v", "ON_ERROR_STOP=1", "-c",
    `select p.sku, coalesce(sum(b."onHand"), 0)::text from erp_products p left join erp_stock_balances b on b."productId" = p.id
     where p.sku in (${skus}) group by p.sku`, url], { capture: true, quiet: true })
    .split("\n").filter(Boolean);
  const inDatabase = new Map(check.map((line) => [line.split("|")[0], Number(line.split("|")[1])]));
  const wrong = plan.products.filter((product) => {
    const expected = plan.balances.filter((balance) => balance.sku === product.sku).reduce((sum, balance) => sum + balance.quantity, 0);
    return Math.abs((inDatabase.get(product.sku) ?? -1) - expected) > 0.0005;
  });
  if (wrong.length) stop(`The database does not match the file for: ${wrong.map((product) => product.name).join(", ")}. Restore ${backup} and send this output.`);
  console.log(`\n✔ Done. ${plan.products.length} items and ${plan.balances.length} balances; every item's stock matches the file. Keep ${backup} until you have checked the app.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("import-inventory.mjs")) {
  await main();
  process.exit(0);
}
