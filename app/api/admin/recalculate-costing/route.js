/*
 * One-time: dyeing and plating are no longer charged (owner, 2026-11-23).
 * On the first batch (offset 0) any saved Costing rates get dyeing and
 * plating set to 0; every batch recalculates saved invoice costings.
 * Answers only to the one-off INVENTORY_IMPORT_TOKEN; remove once done.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { db } from "@/server/core/database/client";
import { getCostingRates, recalculateInvoiceCostings, setCostingRates } from "@/server/costing/costing.service";

export const maxDuration = 60;

function authorized(request) {
  const expected = process.env.INVENTORY_IMPORT_TOKEN?.trim() ?? "";
  const given = request.headers.get("x-import-token")?.trim() ?? "";
  if (expected.length < 32 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } }, { status: 404 });
  try {
    const body = await request.json();
    const [admin] = await db.runtime().query(db.raw.sql`select id::text as id from erp_users order by "createdAt" limit 1`.returnsRow({ id: "pg/text@1" }).build());
    let rates = null;
    if (Number(body.offset ?? 0) === 0) {
      const current = await getCostingRates();
      if (current.configured) {
        const { configured, ...saved } = current;
        void configured;
        await setCostingRates({ ...saved, gauges: saved.gauges.map((gauge) => ({ ...gauge, dyeingPerMeter: 0, platingPerMeter: 0 })) }, admin.id);
        rates = "saved rates: dyeing and plating set to 0";
      } else {
        rates = "no saved rates: the defaults (dyeing and plating 0) apply";
      }
    }
    const step = await recalculateInvoiceCostings({ offset: body.offset, limit: body.limit ?? 15 }, admin.id);
    return NextResponse.json({ success: true, data: { ...step, rates } });
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: "RECALCULATE_FAILED", message: error.message } }, { status: 500 });
  }
}
