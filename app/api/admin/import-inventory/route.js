/*
 * One-time server import of the inventory sheet (D-058), for when the
 * command-line import cannot be run from the owner's PC. It does exactly
 * what npm run db:import-inventory does, in one transaction, and checks
 * every item's stock before committing. It answers only to the one-off
 * token in INVENTORY_IMPORT_TOKEN (32+ characters); without it the route
 * does not exist. Remove the token once the import is done.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import pg from "pg";

import { importSql, readImport, withListedItems } from "@/scripts/inventory-plan.mjs";
import { getDatabaseUrl } from "@/server/core/database/database-url";

export const maxDuration = 60;

const notFound = () => NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });

function authorized(request) {
  const expected = process.env.INVENTORY_IMPORT_TOKEN?.trim() ?? "";
  const given = request.headers.get("x-import-token")?.trim() ?? "";
  if (expected.length < 32 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorized(request)) return notFound();
  let body;
  let plan;
  try {
    body = await request.json();
    plan = readImport(body?.data);
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: "IMPORT_FILE_INVALID", message: error.message } }, { status: 400 });
  }

  const client = new pg.Client({ connectionString: getDatabaseUrl() });
  await client.connect();
  try {
    const listed = (await client.query(`select sku, category, size, "itemType", finish, variant, "logoType" from erp_products where status <> 'ARCHIVED'`)).rows;
    plan = withListedItems(plan, listed);
    const before = (await client.query(`select (select count(*) from erp_stock_balances)::int as balances, (select count(*) from erp_stock_movements)::int as movements,
      (select count(*) from erp_products where sku = any($1))::int as existing`, [plan.products.map((product) => product.sku)])).rows[0];
    const summary = { items: plan.products.length, balances: plan.balances.length, matchedToList: plan.matched, removed: before, itemsUpdated: before.existing, itemsAdded: plan.products.length - before.existing };
    if (body.dryRun) return NextResponse.json({ success: true, data: { dryRun: true, ...summary } });

    await client.query("begin");
    try {
      for (const statement of importSql(plan)) await client.query(statement);
      const rows = (await client.query(`select p.sku, coalesce(sum(b."onHand"), 0)::float8 as stock from erp_products p
        left join erp_stock_balances b on b."productId" = p.id where p.sku = any($1) group by p.sku`, [plan.products.map((product) => product.sku)])).rows;
      const stock = new Map(rows.map((row) => [row.sku, Number(row.stock)]));
      const wrong = plan.products.filter((product) => {
        const expected = plan.balances.filter((balance) => balance.sku === product.sku).reduce((sum, balance) => sum + balance.quantity, 0);
        return Math.abs((stock.get(product.sku) ?? -1) - expected) > 0.0005;
      }).map((product) => product.name);
      if (wrong.length) throw new Error(`Stock does not match the file for: ${wrong.join(", ")}`);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      return NextResponse.json({ success: false, error: { code: "IMPORT_FAILED", message: `Nothing was changed: ${error.message}` } }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: { imported: true, ...summary } });
  } finally {
    await client.end();
  }
}
