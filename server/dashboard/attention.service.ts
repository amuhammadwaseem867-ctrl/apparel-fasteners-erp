/*
 * "Needs attention" for the top bar's bell (D-042): real counts of work
 * waiting on someone, only for the areas the user may see. Nothing is
 * stored; each count is read from the tables when the bell asks.
 */

import { db } from "../core/database/client";

type Item = { key: string; label: string; count: number; href: string };

async function count(query: unknown) {
  const rows = (await db.runtime().query(query as never)) as unknown as Array<{ count: string }>;
  return Number(rows[0]?.count ?? 0);
}

const sql = (strings: TemplateStringsArray) => db.raw.sql(strings).returnsRow({ count: "pg/text@1" }).build();

export async function attentionFor(permissions: string[]) {
  const can = (permission: string) => permissions.includes(permission);
  const checks: Array<[string, string, string, () => Promise<number>]> = [];

  if (can("sales:view")) {
    checks.push(["orders-draft", "Orders waiting for confirmation", "/sales/orders", () => count(sql`
      select count(*)::text as count from erp_sales_orders where status = 'DRAFT'`)]);
  }
  if (can("production:view")) {
    checks.push(["production-hold", "Production orders on hold", "/production/orders", () => count(sql`
      select count(*)::text as count from erp_production_orders where status = 'ON_HOLD'`)]);
    checks.push(["checks-failed", "Stages blocked by a failed check", "/production/orders", () => count(sql`
      select count(distinct (c."productionOrderId", c."stageKey"))::text as count
      from erp_production_stage_checks c
      join erp_production_stages s on s."productionOrderId" = c."productionOrderId" and s."stageKey" = c."stageKey"
      where c.result = 'FAIL' and s.status = 'IN_PROGRESS'`)]);
    checks.push(["packing-draft", "Packing lists to confirm", "/packing/orders", () => count(sql`
      select count(*)::text as count from erp_packing_lists where status = 'DRAFT'`)]);
  }
  if (can("quality:view")) {
    checks.push(["qc-waiting", "Orders waiting for QC", "/quality/inspections", () => count(sql`
      select count(*)::text as count from erp_production_orders
      where "currentStage" = 'quality-check' and status in ('RELEASED', 'IN_PROGRESS')`)]);
  }
  if (can("dispatch:view")) {
    checks.push(["shipments-draft", "Shipments to dispatch", "/dispatch/dispatch", () => count(sql`
      select count(*)::text as count from erp_shipments where status = 'DRAFT'`)]);
  }
  if (can("inventory:view")) {
    checks.push(["gate-passes-draft", "Gate passes waiting for approval", "/dispatch/gate-passes", () => count(sql`
      select count(*)::text as count from erp_gate_passes where status = 'DRAFT'`)]);
  }
  if (can("finance:view")) {
    checks.push(["invoices-draft", "Invoices to issue", "/finance/invoices", () => count(sql`
      select count(*)::text as count from erp_invoices where status = 'DRAFT'`)]);
  }

  const items: Item[] = await Promise.all(checks.map(async ([key, label, href, run]) => ({ key, label, href, count: await run() })));
  const waiting = items.filter((item) => item.count > 0);
  return { items: waiting, total: waiting.reduce((sum, item) => sum + item.count, 0) };
}
