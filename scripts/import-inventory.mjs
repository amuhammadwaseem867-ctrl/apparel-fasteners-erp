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

import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { confirm } from "./confirm.mjs";
import "./load-env.mjs";
import { backupDatabase, pgTool, run, stop } from "./pg-tools.mjs";

const UNITS = { Pcs: 0, Kgs: 3, Mtr: 3 };
const PREFIX = {
  "Teeth": "TEE", "Top Stops": "TOP", "Bottom": "BOT", "Sliders": "SLI", "Pin Box": "PIN", "Two Pins": "TWP",
  "Chain Roll": "CHN", "Tape": "TAP", "Finished Goods": "FG", "Tag String": "TAG", "Thread": "THR",
  "Injection Material": "INJ", "Tipping": "TIP",
};
export const STOCK_TABLES = ["erp_stock_movements", "erp_stock_reservations", "erp_stock_documents", "erp_stock_balances", "erp_batches"];

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const sql = (value) => (value === null || value === undefined || value === "" ? "null" : `'${String(value).replace(/'/g, "''")}'`);
const slug = (value) => String(value).toUpperCase().replace(/[^A-Z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
export const locationCodeFor = (name) => name.toUpperCase().replace(/[^A-Z0-9._]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "LOCATION";

/* Teeth keep the SKUs of AF7's raw material list (TEE-45-YCU-BRAS); every other item gets one from its name. */
export function skuFor(item) {
  if (item.category === "Teeth") {
    return `TEE-${item.size.replace(/[#.]/g, "")}-${item.itemType === "Y-Cut" ? "YCU" : "PLAI"}-${item.material.startsWith("Alum") ? "ALUM" : "BRAS"}`;
  }
  const key = [item.category, item.name, item.size, item.material, item.itemType, item.finish, item.color, item.variant, item.unit].join("|").toLowerCase();
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 5).toUpperCase();
  return `${PREFIX[item.category] ?? "ITM"}-${slug(item.name).slice(0, 40)}-${hash}`;
}

const norm = (value) => String(value ?? "").toLowerCase().replace(/nickle/g, "nickel").replace(/aluminum/g, "aluminium").replace(/[^a-z0-9.]+/g, " ").trim();

/*
 * The sheet's stops, bottoms and sliders are items AF7's raw material list
 * already has (D-044): use those, so nothing is listed twice. A row matches
 * only when exactly one listed item has its size, finish and (for sliders)
 * model and logo. Pins and boxes are counted apart in the sheet, while the
 * list has sets, so they stay their own items.
 */
export function listedSku(item, existing) {
  const finish = /alumin/i.test(`${item.name} ${item.material}`) ? "aluminium" : norm(item.finish);
  if (item.category === "Top Stops" || item.category === "Bottom") {
    const type = item.category === "Top Stops" ? "top stop" : "bottom";
    const found = existing.filter((product) => product.category === item.category && norm(product.size) === norm(item.size)
      && norm(product.finish) === finish && norm(product.itemType) === type);
    return found.length === 1 ? found[0].sku : null;
  }
  if (item.category === "Sliders") {
    const model = /\b(\d{3})\b/.exec(item.itemType ?? "")?.[1];
    if (!model) return null;
    const logo = /no\s*logo/i.test(item.itemType) ? "plain" : /logo/i.test(item.itemType) ? "logo" : null;
    const gauge = norm(item.size);
    const found = existing.filter((product) => {
      const tokens = norm(product.size).split(" ");
      return product.category === "Sliders" && norm(product.finish) === finish && tokens.includes(model)
        && (tokens[0] === model || tokens[0] === gauge) && (!logo || norm(product.logoType) === logo);
    });
    const standard = found.filter((product) => norm(product.variant) === "standard");
    if (found.length === 1) return found[0].sku;
    return standard.length === 1 ? standard[0].sku : null;
  }
  return null;
}

/* Gives each sheet item the SKU of the listed item it matches. */
export function withListedItems(plan, existing) {
  const moved = new Map();
  for (const product of plan.products) {
    const sku = listedSku(product, existing);
    if (sku) moved.set(product.sku, sku);
  }
  const products = new Map();
  for (const product of plan.products) {
    const sku = moved.get(product.sku) ?? product.sku;
    if (!products.has(sku)) products.set(sku, { ...product, sku, listed: moved.has(product.sku) });
  }
  const balances = new Map();
  for (const balance of plan.balances) {
    const sku = moved.get(balance.sku) ?? balance.sku;
    const key = `${sku}|${locationCodeFor(balance.location)}`;
    const total = balances.get(key) ?? { ...balance, sku, quantity: 0 };
    total.quantity = Number((total.quantity + balance.quantity).toFixed(3));
    balances.set(key, total);
  }
  return { products: [...products.values()], balances: [...balances.values()], matched: moved.size };
}

/* The import file, checked: one product per distinct item, one balance per item and location. */
export function readImport(data) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) throw new Error("The file has no items.");
  const problems = [];
  const products = new Map();
  const balances = new Map();
  data.items.forEach((item, index) => {
    const where = `${index + 1}. ${item.name} (${item.sheet} row ${item.row})`;
    if (!String(item.name ?? "").trim()) problems.push(`${where}: no name`);
    if (!(item.unit in UNITS)) problems.push(`${where}: unit ${item.unit} is not Pcs, Kgs or Mtr`);
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 0) problems.push(`${where}: quantity ${item.quantity} is not a stock quantity`);
    for (const field of ["unitWeightGrams", "unitPrice"]) {
      if (item[field] !== null && item[field] !== undefined && !(typeof item[field] === "number" && item[field] > 0)) problems.push(`${where}: ${field} ${item[field]} is not a positive number`);
    }
    const sku = skuFor(item);
    const known = products.get(sku);
    if (known && known.unit !== item.unit) problems.push(`${where}: the same item is in ${known.unit} elsewhere`);
    products.set(sku, { ...known, ...item, sku, unitWeightGrams: item.unitWeightGrams ?? known?.unitWeightGrams ?? null, unitPrice: item.unitPrice ?? known?.unitPrice ?? null });
    const location = String(item.location ?? "").trim() || "General";
    const key = `${sku}|${locationCodeFor(location)}`;
    const quantity = Number(item.quantity.toFixed(UNITS[item.unit] ?? 3));
    const balance = balances.get(key) ?? { sku, location, quantity: 0 };
    balance.quantity = Number((balance.quantity + quantity).toFixed(3));
    balances.set(key, balance);
  });
  if (problems.length) throw new Error(`The import file has problems:\n  ${problems.join("\n  ")}`);
  return { products: [...products.values()], balances: [...balances.values()].filter((balance) => balance.quantity > 0) };
}

/* The statements that replace the stock, run in one transaction. */
export function importSql({ products, balances }, today = new Date().toISOString().slice(0, 10)) {
  const year = today.slice(0, 4);
  const documentId = randomUUID();
  const statements = [
    `do $$ begin if not exists (select 1 from erp_users) then raise exception 'There is no user to record the stock document.'; end if; end $$`,
    ...STOCK_TABLES.map((table) => `delete from ${table}`),
    // AF7 keeps one warehouse (MAIN, else the oldest active one).
    `insert into erp_warehouses (id, code, name, "warehouseType", status, "createdAt", "updatedAt")
      select gen_random_uuid(), 'MAIN', 'AF7 Main Warehouse', 'GENERAL', 'ACTIVE', now(), now()
      where not exists (select 1 from erp_warehouses where status = 'ACTIVE')`,
    `create temporary table import_warehouse on commit drop as
      select id from erp_warehouses where status = 'ACTIVE' order by (code = 'MAIN') desc, "createdAt" limit 1`,
  ];
  const locations = [...new Map(balances.map((balance) => [locationCodeFor(balance.location), balance.location])).entries()];
  for (const [code, name] of locations) {
    statements.push(`insert into erp_storage_locations (id, "warehouseId", code, name, status, "createdAt", "updatedAt")
      select gen_random_uuid(), w.id, ${sql(code)}, ${sql(name)}, 'ACTIVE', now(), now() from import_warehouse w
      where not exists (select 1 from erp_storage_locations l where l."warehouseId" = w.id and (l.code = ${sql(code)} or lower(trim(l.name)) = lower(${sql(name)})))`);
    statements.push(`update erp_storage_locations l set status = 'ACTIVE', "updatedAt" = now() from import_warehouse w
      where l."warehouseId" = w.id and (l.code = ${sql(code)} or lower(trim(l.name)) = lower(${sql(name)})) and l.status <> 'ACTIVE'`);
  }
  for (const product of products) {
    const values = [
      sql(product.sku), sql(product.name), sql(product.category), sql(product.productType || "Raw Material"), sql(product.variant),
      sql(product.unit), product.unitPrice ?? 0, sql(product.size), sql(product.material), sql(product.itemType), sql(product.finish),
      sql(product.color), product.unitWeightGrams ?? "null",
    ];
    statements.push(`insert into erp_products (id, sku, name, category, "productType", variant, unit, "unitPrice", size, material, "itemType", finish, color, "unitWeightGrams", status, "minimumStock", "createdAt", "updatedAt")
      values (gen_random_uuid(), ${values.join(", ")}, 'ACTIVE', 0, now(), now())
      on conflict (sku) do update set unit = excluded.unit, status = 'ACTIVE', "updatedAt" = now(),
        "unitPrice" = case when excluded."unitPrice" > 0 then excluded."unitPrice" else erp_products."unitPrice" end,
        "unitWeightGrams" = coalesce(excluded."unitWeightGrams", erp_products."unitWeightGrams"),
        "productType" = erp_products."productType"`);
  }
  if (balances.length) {
    statements.push(`with seq as (
        insert into erp_document_sequences (key, "nextValue", "updatedAt") values ('SIN-${year}', 2, now())
        on conflict (key) do update set "nextValue" = erp_document_sequences."nextValue" + 1, "updatedAt" = now()
        returning "nextValue" - 1 as n
      )
      insert into erp_stock_documents (id, "documentNumber", "documentType", status, reference, reason, notes, "idempotencyKey", "createdBy", "postedAt")
      select ${sql(documentId)}, 'SIN-${year}-' || lpad(n::text, 6, '0'), 'STOCK_IN', 'POSTED', 'Inventory sheet',
        'Opening stock from the inventory sheet', ${sql(`${balances.length} balances, imported ${today}`)}, ${sql(`inventory-import:${documentId}`)},
        (select id from erp_users order by "createdAt" limit 1), now()
      from seq`);
    for (let start = 0; start < balances.length; start += 200) {
      const rows = balances.slice(start, start + 200).map((balance, index) => `(${start + index + 1}, ${sql(balance.sku)}, ${sql(locationCodeFor(balance.location))}, ${sql(balance.location)}, ${balance.quantity})`);
      statements.push(`with lines (line_no, sku, code, name, quantity) as (values ${rows.join(",\n")}),
        resolved as (
          select lines.line_no, p.id as product_id, l.id as location_id, lines.quantity::numeric as quantity
          from lines
          join erp_products p on p.sku = lines.sku
          join import_warehouse w on true
          join lateral (select id from erp_storage_locations l where l."warehouseId" = w.id and (l.code = lines.code or lower(trim(l.name)) = lower(lines.name)) order by (l.code = lines.code) desc limit 1) l on true
        ),
        moved as (
          insert into erp_stock_movements (id, "documentId", "lineNo", "movementType", "productId", "locationId", bucket, "quantityDelta", "balanceAfter", "createdBy", "createdAt")
          select gen_random_uuid(), ${sql(documentId)}, line_no, 'STOCK_IN', product_id, location_id, 'ON_HAND', quantity, quantity,
            (select id from erp_users order by "createdAt" limit 1), now()
          from resolved returning "productId", "locationId", "quantityDelta"
        )
        insert into erp_stock_balances (id, "productId", "locationId", "onHand", reserved, "qualityHold", "updatedAt")
        select gen_random_uuid(), "productId", "locationId", "quantityDelta", 0, 0, now() from moved`);
    }
  }
  return statements;
}

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
