/*
 * MRP runs: gathers demand, active BOMs and stock, calls the pure engine
 * (mrp-engine.ts) and stores the run so the plan stays explainable later.
 *
 * Demand: catalogue lines of APPROVED sales orders whose delivery date is
 * on or before the horizon (orders without a delivery date are included).
 * Limitation, stated in every run's parameters: there is no dispatch module
 * yet, so delivered quantities cannot be subtracted.
 *
 * Supply: unreserved, non-held stock (onHand - reserved - qualityHold)
 * plus stock reserved for the demanded orders themselves. No scheduled
 * receipts are counted: there is no procurement module yet.
 *
 * Runs are serialised with a transaction-level advisory lock, so two
 * concurrent runs cannot interleave. Planned orders are suggestions; a
 * confirmation is an explicit, audited compare-and-set.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { addDecimalStrings, normalizeDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { unitDecimals } from "../inventory/stock-rules";
import { BomCycleError, calculateMrp, type BomDefinition } from "./mrp-engine";
import type { MrpRunInput } from "./planning.validation";

async function rows<T>(tx: Tx | null, plan: unknown): Promise<T[]> {
  const runner = tx ?? db.runtime();
  return (await runner.query(plan as never)) as unknown as T[];
}

const ASSUMPTIONS = [
  "Demand = catalogue lines of approved sales orders within the horizon.",
  "Delivered quantities are not subtracted (no dispatch module yet).",
  "Supply = unreserved, non-held stock plus stock reserved for the demanded orders.",
  "No scheduled receipts (no procurement module yet).",
  "Reserved-for-other-orders and quality-held stock are not counted as supply.",
  "Component scrap applied once per BOM line; planned quantities rounded up to the unit's precision.",
];

export async function runMrp(input: MrpRunInput, actorId: string) {
  const horizon = input.horizonDate || null;

  try {
    const runId = await db.transaction(async (tx) => {
      // One MRP run at a time.
      await rows(tx, db.raw.sql`select pg_advisory_xact_lock(hashtext('erp-mrp-run'))::text as locked`
        .returnsRow({ locked: "pg/text@1" }).build());

      const demandRows = await rows<{
        salesOrderId: string; salesOrderLineId: string; orderNumber: string;
        productId: string; quantity: string; dueDate: string | null;
      }>(tx, db.raw.sql`
        select o.id::text as "salesOrderId", l.id::text as "salesOrderLineId", o."orderNumber",
               l."productId"::text as "productId", l.quantity::text as quantity, o."deliveryDate" as "dueDate"
        from erp_sales_orders o
        join erp_sales_order_lines l on l."salesOrderId" = o.id
        where o.status = 'APPROVED' and l."productId" is not null
          and (${horizon ?? ""} = '' or o."deliveryDate" is null or o."deliveryDate" <= ${horizon ?? ""})
        order by o."orderNumber", l.id
      `.returnsRow({
        salesOrderId: "pg/text@1", salesOrderLineId: "pg/text@1", orderNumber: "pg/text@1",
        productId: "pg/text@1", quantity: "pg/text@1", dueDate: { codecId: "pg/text@1", nullable: true },
      }).build());

      const bomRows = await rows<{ bomId: string; revision: string; productId: string; componentId: string; quantity: string; scrapPercent: string }>(tx, db.raw.sql`
        select b.id::text as "bomId", b.revision::text as revision, b."productId"::text as "productId",
               l."componentId"::text as "componentId", l.quantity::text as quantity, l."scrapPercent"::text as "scrapPercent"
        from erp_boms b join erp_bom_lines l on l."bomId" = b.id
        where b."isActive"
        order by b."productId", l."lineNo"
      `.returnsRow({
        bomId: "pg/text@1", revision: "pg/text@1", productId: "pg/text@1",
        componentId: "pg/text@1", quantity: "pg/text@1", scrapPercent: "pg/text@1",
      }).build());

      const stockRows = await rows<{ productId: string; free: string; unit: string }>(tx, db.raw.sql`
        select p.id::text as "productId", p.unit,
               coalesce(sum(b."onHand" - b."reserved" - b."qualityHold"), 0)::text as free
        from erp_products p left join erp_stock_balances b on b."productId" = p.id
        group by p.id
      `.returnsRow({ productId: "pg/text@1", free: "pg/text@1", unit: "pg/text@1" }).build());

      const orderIds = [...new Set(demandRows.map((row) => row.salesOrderId))];
      const allocatedRows = orderIds.length
        ? await rows<{ productId: string; open: string }>(tx, db.raw.sql`
          select "productId"::text as "productId",
                 sum(quantity - "consumedQuantity" - "releasedQuantity")::text as open
          from erp_stock_reservations
          where status = 'ACTIVE' and "salesOrderId"::text = any(string_to_array(${orderIds.join(",")}, ','))
          group by "productId"
        `.returnsRow({ productId: "pg/text@1", open: "pg/text@1" }).build())
        : [];

      const demand = new Map<string, string>();
      for (const row of demandRows) {
        demand.set(row.productId, addDecimalStrings(demand.get(row.productId) ?? "0", row.quantity));
      }

      const boms = new Map<string, BomDefinition>();
      for (const row of bomRows) {
        const bom = boms.get(row.productId) ?? { bomId: row.bomId, revision: Number(row.revision), lines: [] };
        bom.lines.push({ componentId: row.componentId, quantity: row.quantity, scrapPercent: row.scrapPercent });
        boms.set(row.productId, bom);
      }

      const results = calculateMrp({
        demand,
        boms,
        allocated: new Map(allocatedRows.map((row) => [row.productId, row.open])),
        available: new Map(stockRows.map((row) => [row.productId, row.free])),
        unitDecimals: new Map(stockRows.map((row) => [row.productId, unitDecimals(row.unit)])),
      });

      // Earliest due date of the demand that drives each top-level item.
      const dueByProduct = new Map<string, string>();
      for (const row of demandRows) {
        if (row.dueDate && (!dueByProduct.has(row.productId) || row.dueDate < dueByProduct.get(row.productId)!)) {
          dueByProduct.set(row.productId, row.dueDate);
        }
      }

      const planned = results.filter((row) => Number(row.plannedQuantity) > 0);
      const runNumber = await allocateDocumentNumber(tx, "MRP");
      const run = await tx.orm.public.MrpRun.create({
        runNumber,
        parameters: JSON.stringify({ horizonDate: horizon, assumptions: ASSUMPTIONS }),
        demandCount: demandRows.length,
        plannedCount: planned.length,
        createdBy: actorId,
      });

      for (const row of demandRows) {
        await tx.orm.public.MrpDemand.create({ runId: run.id, ...row, dueDate: row.dueDate ?? null });
      }

      for (const row of results) {
        await tx.orm.public.MrpRequirement.create({ runId: run.id, ...row });
      }

      for (const row of planned) {
        await tx.orm.public.MrpPlannedOrder.create({
          runId: run.id,
          productId: row.productId,
          orderType: row.supplyType,
          quantity: row.plannedQuantity,
          dueDate: dueByProduct.get(row.productId) ?? null,
        });
      }

      await recordAuditEvent({
        actorId,
        action: "MRP_RUN_COMPLETED",
        entityType: "MrpRun",
        entityId: run.id,
        metadata: { runNumber, demandLines: demandRows.length, plannedOrders: planned.length, horizonDate: horizon },
      }, tx);

      return run.id;
    });

    return getMrpRun(runId);
  } catch (error) {
    if (error instanceof BomCycleError) {
      throw new AppError(`Active BOMs contain a cycle (${error.path.length - 1} items). Fix the BOMs before running MRP.`, {
        code: "BOM_CYCLE",
        status: 409,
        details: { path: error.path },
      });
    }
    throw error;
  }
}

async function productMap(ids: string[]) {
  const products = ids.length
    ? await db.orm.public.Product.where((product) => product.id.in(ids)).all()
    : [];
  return new Map(products.map((product) => [product.id, product]));
}

export async function listMrpRuns(page: number, pageSize: number) {
  const result = await db.orm.public.MrpRun
    .orderBy((run) => run.createdAt.desc())
    .offset((page - 1) * pageSize)
    .limit(pageSize + 1)
    .all();

  return { runs: result.slice(0, pageSize), page, pageSize, hasMore: result.length > pageSize };
}

export async function latestMrpRunId(): Promise<string | null> {
  const run = await db.orm.public.MrpRun.orderBy((row) => row.createdAt.desc()).first();
  return run?.id ?? null;
}

export async function getMrpRun(id: string) {
  const run = await db.orm.public.MrpRun.where({ id }).first();

  if (!run) {
    throw new AppError("MRP run not found.", { code: "MRP_RUN_NOT_FOUND", status: 404 });
  }

  const [demands, requirements, plannedOrders] = [
    await db.orm.public.MrpDemand.where({ runId: id }).all(),
    await db.orm.public.MrpRequirement.where({ runId: id }).all(),
    await db.orm.public.MrpPlannedOrder.where({ runId: id }).all(),
  ];
  const products = await productMap([...new Set([
    ...demands.map((row) => row.productId),
    ...requirements.map((row) => row.productId),
  ])]);
  const describe = (productId: string) => ({
    sku: products.get(productId)?.sku ?? null,
    productName: products.get(productId)?.name ?? null,
    unit: products.get(productId)?.unit ?? null,
  });
  const decimal = (value: unknown) => normalizeDecimalString(String(value));
  const converted = plannedOrders.length
    ? await db.orm.public.ProductionOrder
      .where((order) => order.plannedOrderId.in(plannedOrders.map((row) => row.id)))
      .select("id", "orderNumber", "plannedOrderId")
      .all()
    : [];
  const productionOrder = new Map(converted.map((order) => [order.plannedOrderId, order]));

  return {
    ...run,
    parameters: JSON.parse(run.parameters),
    demands: demands.map((row) => ({ ...row, quantity: decimal(row.quantity), ...describe(row.productId) })),
    requirements: requirements
      .map((row) => ({
        ...row,
        grossRequirement: decimal(row.grossRequirement),
        allocatedStock: decimal(row.allocatedStock),
        availableStock: decimal(row.availableStock),
        netRequirement: decimal(row.netRequirement),
        plannedQuantity: decimal(row.plannedQuantity),
        ...describe(row.productId),
      }))
      .sort((a, b) => a.lowLevelCode - b.lowLevelCode || String(a.sku).localeCompare(String(b.sku))),
    plannedOrders: plannedOrders
      .map((row) => ({
        ...row,
        quantity: decimal(row.quantity),
        ...describe(row.productId),
        productionOrderId: productionOrder.get(row.id)?.id ?? null,
        productionOrderNumber: productionOrder.get(row.id)?.orderNumber ?? null,
      }))
      .sort((a, b) => String(a.sku).localeCompare(String(b.sku))),
  };
}

/* SUGGESTED -> CONFIRMED or CANCELLED, exactly once. */
export async function setPlannedOrderStatus(id: string, status: "CONFIRMED" | "CANCELLED", actorId: string) {
  await db.transaction(async (tx) => {
    const changed = status === "CONFIRMED"
      ? await rows<{ id: string }>(tx, db.raw.sql`
          update erp_mrp_planned_orders
            set status = 'CONFIRMED', "confirmedBy" = ${actorId}::uuid, "confirmedAt" = now()
          where id = ${id}::uuid and status = 'SUGGESTED'
          returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build())
      : await rows<{ id: string }>(tx, db.raw.sql`
          update erp_mrp_planned_orders set status = 'CANCELLED'
          where id = ${id}::uuid and status = 'SUGGESTED'
          returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build());

    if (!changed.length) {
      throw new AppError("Only a suggested planned order can be confirmed or cancelled.", {
        code: "PLANNED_ORDER_STATUS_CONFLICT",
        status: 409,
      });
    }

    await recordAuditEvent({
      actorId,
      action: status === "CONFIRMED" ? "PLANNED_ORDER_CONFIRMED" : "PLANNED_ORDER_CANCELLED",
      entityType: "MrpPlannedOrder",
      entityId: id,
    }, tx);
  });

  const order = await db.orm.public.MrpPlannedOrder.where({ id }).first();
  return { ...order, quantity: normalizeDecimalString(String(order!.quantity)) };
}
