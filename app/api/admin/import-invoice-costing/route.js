/*
 * One-time server import of the Aug-Nov invoices' costing into the costing
 * history (D-060), for when it cannot be run from the owner's PC. Answers
 * only to the one-off token in INVENTORY_IMPORT_TOKEN (32+ characters);
 * without it the route does not exist. Remove once the import is done.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { db } from "@/server/core/database/client";
import { importInvoiceCostings, invoiceCostingSchema } from "@/server/costing/costing.service";

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
  try {
    const body = await request.json();
    const parsed = invoiceCostingSchema.parse(body.data);
    if (body.dryRun) return NextResponse.json({ success: true, data: { dryRun: true, invoices: parsed.invoices.length } });
    const [admin] = await db.runtime().query(db.raw.sql`
      select u.id::text as id from erp_users u order by u."createdAt" limit 1
    `.returnsRow({ id: "pg/text@1" }).build());
    const result = await importInvoiceCostings(parsed, admin.id);
    return NextResponse.json({ success: true, data: { saved: result.saved.length, first: result.saved[0], last: result.saved.at(-1) } });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: "IMPORT_FAILED", message: `Nothing was changed: ${error.message}` } }, { status: 500 });
  }
}
