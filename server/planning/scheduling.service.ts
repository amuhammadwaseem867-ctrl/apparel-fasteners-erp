/*
 * Capacity, calendar and production plans (D-034).
 *
 * Work centres: one per production stage, with capacity per shift in one
 *   unit and shifts per day. Load is the quantity still to pass each stage
 *   on open production orders; quantities in a different unit from the
 *   capacity are listed separately, never added (D-011 spirit).
 * Calendar: weekly off days (setting) plus dated holidays, shutdowns and
 *   extra working days. Working days drive capacity, leave counting
 *   (holidays/shutdowns) and plan checks.
 * Production plans: DRAFT (lines editable) -> APPROVED -> CLOSED, or
 *   CANCELLED. An approved plan's lines are released one by one into
 *   production orders, atomically and at most once per line.
 */

import { PRODUCTION_STAGES } from "../../config/production.js";
import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import { insertProductionOrderInTransaction } from "../production/production.service";
import { getSetting } from "../settings/settings.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGES = PRODUCTION_STAGES as Array<{ key: string; sequence: number; label: string; department: string }>;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const today = () => new Date().toISOString().slice(0, 10);
const unique = (error: unknown) => (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) out.push(new Date(time).toISOString().slice(0, 10));
  return out;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export async function workingDays(from: string, to: string) {
  const { days: weeklyOff } = await getSetting("planning.weeklyOff");
  const overrides = await db.orm.public.CalendarDay.where((day) => day.date.gte(from)).where((day) => day.date.lte(to)).all();
  const byDate = new Map(overrides.map((day) => [day.date, day.dayType]));
  return datesBetween(from, to).filter((date) => {
    const type = byDate.get(date);
    if (type === "WORKING") return true;
    if (type === "HOLIDAY" || type === "SHUTDOWN") return false;
    return !weeklyOff.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  });
}

export async function getCalendarMonth(month: string) {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const { days: weeklyOff, configured } = await getSetting("planning.weeklyOff");
  const overrides = await db.orm.public.CalendarDay.where((day) => day.date.gte(from)).where((day) => day.date.lte(to)).all();
  const production = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select o.id::text as id, o."orderNumber" as number, o."dueDate" as date, o.status, p.sku, o.quantity::text as quantity, o.unit
    from erp_production_orders o join erp_products p on p.id = o."productId"
    where o."dueDate" between ${from} and ${to} and o.status not in ('CANCELLED')
  `.returnsRow({ id: "pg/text@1", number: "pg/text@1", date: "pg/text@1", status: "pg/text@1", sku: "pg/text@1", quantity: "pg/text@1", unit: "pg/text@1" }).build());
  const deliveries = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select s.id::text as id, s."orderNumber" as number, s."deliveryDate" as date, s.status, c.name as customer
    from erp_sales_orders s join erp_customers c on c.id = s."customerId"
    where s."deliveryDate" between ${from} and ${to} and s.status = 'APPROVED'
  `.returnsRow({ id: "pg/text@1", number: "pg/text@1", date: "pg/text@1", status: "pg/text@1", customer: "pg/text@1" }).build());
  const purchases = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select o.id::text as id, o."poNumber" as number, o."expectedDate" as date, o.status, s.name as supplier
    from erp_purchase_orders o join erp_suppliers s on s.id = o."supplierId"
    where o."expectedDate" between ${from} and ${to} and o.status in ('APPROVED', 'PARTIALLY_RECEIVED')
  `.returnsRow({ id: "pg/text@1", number: "pg/text@1", date: "pg/text@1", status: "pg/text@1", supplier: "pg/text@1" }).build());
  const working = new Set(await workingDays(from, to));
  return {
    month, weeklyOff, weeklyOffConfigured: configured,
    days: datesBetween(from, to).map((date) => {
      const override = overrides.find((day) => day.date === date);
      return {
        date, working: working.has(date), weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
        override: override ? { id: override.id, dayType: override.dayType, note: override.note } : null,
        production: production.filter((row) => row.date === date).map((row) => ({ ...row, quantity: dec(row.quantity) })),
        deliveries: deliveries.filter((row) => row.date === date),
        purchases: purchases.filter((row) => row.date === date),
      };
    }),
  };
}

export async function setCalendarDay(input: { date: string; dayType: "HOLIDAY" | "SHUTDOWN" | "WORKING"; note?: string }, actorId: string) {
  await db.runtime().query(db.raw.sql`
    insert into erp_calendar_days (id, date, "dayType", note, "createdBy") values (gen_random_uuid(), ${input.date}, ${input.dayType}, nullif(${input.note ?? ""}, ''), ${actorId}::uuid)
    on conflict (date) do update set "dayType" = excluded."dayType", note = excluded.note, "createdBy" = excluded."createdBy", "createdAt" = now()
    returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build() as never);
  await recordAuditEvent({ actorId, action: "CALENDAR_DAY_SET", entityType: "CalendarDay", entityId: null, metadata: input });
  return db.orm.public.CalendarDay.where({ date: input.date }).first();
}

/* Removes a dated override; the day falls back to the weekly pattern. */
export async function clearCalendarDay(date: string, actorId: string) {
  const removed = await rows<{ id: string }>(db.runtime(), db.raw.sql`delete from erp_calendar_days where date = ${date} returning id::text as id`.returnsRow({ id: "pg/text@1" }).build());
  if (!removed.length) throw new AppError("That day has no override.", { code: "CALENDAR_DAY_NOT_FOUND", status: 404 });
  await recordAuditEvent({ actorId, action: "CALENDAR_DAY_CLEARED", entityType: "CalendarDay", entityId: null, metadata: { date } });
  return { date };
}

/* ------------------------------------------------------------------ */
/* Work centres and capacity                                           */
/* ------------------------------------------------------------------ */

export async function listWorkCenters() {
  const centers = await db.orm.public.WorkCenter.all();
  return STAGES.map((stage) => {
    const center = centers.find((row) => row.stageKey === stage.key);
    return {
      stageKey: stage.key, sequence: stage.sequence, label: stage.label, department: stage.department,
      configured: Boolean(center), name: center?.name ?? stage.label,
      dailyCapacity: center ? dec(center.dailyCapacity) : null, capacityUnit: center?.capacityUnit ?? null,
      shiftsPerDay: center?.shiftsPerDay ?? null, notes: center?.notes ?? null,
    };
  });
}

export async function saveWorkCenter(stageKey: string, input: { name: string; dailyCapacity: number; capacityUnit: string; shiftsPerDay: number; notes?: string }, actorId: string) {
  if (!STAGES.some((stage) => stage.key === stageKey)) throw new AppError("Unknown production stage.", { code: "STAGE_NOT_FOUND", status: 404 });
  const capacity = toPlainDecimalString(input.dailyCapacity);
  await db.runtime().query(db.raw.sql`
    insert into erp_work_centers (id, "stageKey", name, "dailyCapacity", "capacityUnit", "shiftsPerDay", notes, "updatedBy", "updatedAt")
    values (gen_random_uuid(), ${stageKey}, ${input.name}, ${capacity}::numeric, ${input.capacityUnit}, ${input.shiftsPerDay}, nullif(${input.notes ?? ""}, ''), ${actorId}::uuid, now())
    on conflict ("stageKey") do update set name = excluded.name, "dailyCapacity" = excluded."dailyCapacity", "capacityUnit" = excluded."capacityUnit",
      "shiftsPerDay" = excluded."shiftsPerDay", notes = excluded.notes, "updatedBy" = excluded."updatedBy", "updatedAt" = now()
    returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build() as never);
  await recordAuditEvent({ actorId, action: "WORK_CENTER_SAVED", entityType: "WorkCenter", entityId: null, metadata: { stageKey, dailyCapacity: capacity, unit: input.capacityUnit } });
  return (await listWorkCenters()).find((row) => row.stageKey === stageKey);
}

/*
 * Remaining quantity at each stage of open production orders, per unit,
 * against capacity over the next `horizonDays` working days.
 */
export async function getCapacityLoad(horizonDays = 30, asOf = today()) {
  const centers = await listWorkCenters();
  const remaining = await rows<{ stageKey: string; unit: string; quantity: string; orders: string; overdue: string }>(db.runtime(), db.raw.sql`
    select s."stageKey", o.unit, sum(greatest(o.quantity - s."processedQuantity", 0))::text as quantity, count(distinct o.id)::text as orders,
      count(distinct o.id) filter (where o."dueDate" < ${asOf})::text as overdue
    from erp_production_stages s join erp_production_orders o on o.id = s."productionOrderId"
    where o.status in ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD') and s.status <> 'COMPLETED' and o.quantity > s."processedQuantity"
    group by s."stageKey", o.unit
  `.returnsRow({ stageKey: "pg/text@1", unit: "pg/text@1", quantity: "pg/text@1", orders: "pg/text@1", overdue: "pg/text@1" }).build());
  const end = new Date(Date.parse(`${asOf}T00:00:00Z`) + (horizonDays - 1) * 86400000).toISOString().slice(0, 10);
  const days = (await workingDays(asOf, end)).length;
  return {
    asOf, horizonDays, workingDays: days,
    stages: centers.map((center) => {
      const loads = remaining.filter((row) => row.stageKey === center.stageKey);
      const comparable = loads.find((row) => center.capacityUnit && row.unit === center.capacityUnit);
      const perDay = center.dailyCapacity && center.shiftsPerDay ? Number(center.dailyCapacity) * center.shiftsPerDay : null;
      const loadDays = comparable && perDay ? Number(comparable.quantity) / perDay : null;
      return {
        ...center,
        perDayCapacity: perDay === null ? null : normalizeDecimalString(String(perDay)),
        load: loads.map((row) => ({ unit: row.unit, quantity: dec(row.quantity), orders: Number(row.orders), overdueOrders: Number(row.overdue) })),
        loadDays: loadDays === null ? null : Number(loadDays.toFixed(1)),
        utilisationPercent: loadDays === null || days === 0 ? null : Number(((loadDays / days) * 100).toFixed(1)),
        otherUnits: loads.filter((row) => row !== comparable).map((row) => row.unit),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Production plans                                                    */
/* ------------------------------------------------------------------ */

type PlanLineInput = { productId: string; quantity: number; dueDate: string; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; notes?: string };

async function validateLines(lines: PlanLineInput[], periodStart: string, periodEnd: string) {
  const products = await db.orm.public.Product.where((product) => product.id.in([...new Set(lines.map((line) => line.productId))])).all();
  for (const [index, line] of lines.entries()) {
    const product = products.find((row) => row.id === line.productId);
    if (!product) throw new AppError(`Line ${index + 1}: item not found.`, { code: "PRODUCT_NOT_FOUND", status: 400 });
    if (product.status === "ARCHIVED") throw new AppError(`Line ${index + 1}: ${product.sku} is archived.`, { code: "PRODUCT_ARCHIVED", status: 409 });
    const precision = quantityPrecisionError(line.quantity, product.unit);
    if (precision) throw new AppError(`Line ${index + 1}: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
    if (line.dueDate < periodStart || line.dueDate > periodEnd) throw new AppError(`Line ${index + 1}: the due date is outside the plan period.`, { code: "PLAN_LINE_OUTSIDE_PERIOD", status: 400 });
  }
}

async function writeLines(tx: Tx, planId: string, lines: PlanLineInput[]) {
  for (const [index, line] of lines.entries()) {
    await tx.orm.public.ProductionPlanLine.create({ planId, lineNo: index + 1, productId: line.productId, quantity: toPlainDecimalString(line.quantity), dueDate: line.dueDate, priority: line.priority, notes: line.notes || null });
  }
}

export async function createPlan(input: { title: string; periodStart: string; periodEnd: string; notes?: string; lines: PlanLineInput[]; idempotencyKey: string }, actorId: string) {
  const replay = await db.orm.public.ProductionPlan.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getPlan(replay.id);
  await validateLines(input.lines, input.periodStart, input.periodEnd);
  try {
    const id = await db.transaction(async (tx) => {
      const planNumber = await allocateDocumentNumber(tx, "PLN");
      const plan = await tx.orm.public.ProductionPlan.create({ planNumber, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, notes: input.notes || null, idempotencyKey: input.idempotencyKey, createdBy: actorId });
      await writeLines(tx, plan.id, input.lines);
      await recordAuditEvent({ actorId, action: "PRODUCTION_PLAN_CREATED", entityType: "ProductionPlan", entityId: plan.id, metadata: { planNumber, lines: input.lines.length } }, tx);
      return plan.id;
    });
    return getPlan(id);
  } catch (error) {
    if (unique(error)) {
      const original = await db.orm.public.ProductionPlan.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getPlan(original.id);
    }
    throw error;
  }
}

async function lockPlan(tx: Tx, id: string) {
  const [plan] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_production_plans where id = ${id}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
  if (!plan) throw new AppError("Plan not found.", { code: "PLAN_NOT_FOUND", status: 404 });
  return plan.status;
}

export async function updatePlanLines(id: string, input: { title: string; periodStart: string; periodEnd: string; notes?: string; lines: PlanLineInput[] }, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Plan not found.", { code: "PLAN_NOT_FOUND", status: 404 });
  await validateLines(input.lines, input.periodStart, input.periodEnd);
  await db.transaction(async (tx) => {
    if ((await lockPlan(tx, id)) !== "DRAFT") throw new AppError("Only draft plans can be edited.", { code: "PLAN_NOT_EDITABLE", status: 409 });
    await tx.orm.public.ProductionPlanLine.where({ planId: id }).deleteAll();
    await tx.orm.public.ProductionPlan.where({ id }).update({ title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, notes: input.notes || null });
    await writeLines(tx, id, input.lines);
    await recordAuditEvent({ actorId, action: "PRODUCTION_PLAN_UPDATED", entityType: "ProductionPlan", entityId: id, metadata: { lines: input.lines.length } }, tx);
  });
  return getPlan(id);
}

export async function changePlan(id: string, action: "approve" | "close" | "cancel", actorId: string) {
  if (!UUID.test(id)) throw new AppError("Plan not found.", { code: "PLAN_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const status = await lockPlan(tx, id);
    const lines = await tx.orm.public.ProductionPlanLine.where({ planId: id }).all();
    const now = new Date().toISOString();
    if (action === "approve") {
      if (status !== "DRAFT") throw new AppError("Only draft plans can be approved.", { code: "PLAN_STATUS_CONFLICT", status: 409 });
      if (!lines.length) throw new AppError("Add at least one line before approving.", { code: "PLAN_EMPTY", status: 409 });
      await tx.orm.public.ProductionPlan.where({ id }).update({ status: "APPROVED", approvedBy: actorId, approvedAt: now });
    } else if (action === "close") {
      if (status !== "APPROVED") throw new AppError("Only approved plans can be closed.", { code: "PLAN_STATUS_CONFLICT", status: 409 });
      // Lines never released are cancelled with the plan; released orders carry on.
      await tx.query(db.raw.sql`update erp_production_plan_lines set status = 'CANCELLED' where "planId" = ${id}::uuid and status = 'PLANNED' returning id::text as id`.returnsRow({ id: "pg/text@1" }).build());
      await tx.orm.public.ProductionPlan.where({ id }).update({ status: "CLOSED" });
    } else {
      if (status !== "DRAFT") throw new AppError("Only draft plans can be cancelled; close an approved plan instead.", { code: "PLAN_STATUS_CONFLICT", status: 409 });
      await tx.orm.public.ProductionPlan.where({ id }).update({ status: "CANCELLED" });
    }
    await recordAuditEvent({ actorId, action: `PRODUCTION_PLAN_${action.toUpperCase()}`, entityType: "ProductionPlan", entityId: id }, tx);
  });
  return getPlan(id);
}

/* Releases one line of an approved plan into a production order (once). */
export async function releasePlanLine(planId: string, lineId: string, actorId: string) {
  if (!UUID.test(planId) || !UUID.test(lineId)) throw new AppError("Plan line not found.", { code: "PLAN_LINE_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    if ((await lockPlan(tx, planId)) !== "APPROVED") throw new AppError("Lines are released from approved plans only.", { code: "PLAN_STATUS_CONFLICT", status: 409 });
    const [line] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_production_plan_lines where id = ${lineId}::uuid and "planId" = ${planId}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!line) throw new AppError("Plan line not found.", { code: "PLAN_LINE_NOT_FOUND", status: 404 });
    if (line.status !== "PLANNED") throw new AppError(`This line is already ${line.status.toLowerCase()}.`, { code: "PLAN_LINE_STATUS_CONFLICT", status: 409 });
    const row = (await tx.orm.public.ProductionPlanLine.where({ id: lineId }).first())!;
    const plan = (await tx.orm.public.ProductionPlan.where({ id: planId }).first())!;
    const product = await tx.orm.public.Product.where({ id: row.productId }).first();
    if (!product || product.status === "ARCHIVED") throw new AppError("The item on this line is archived.", { code: "PRODUCT_ARCHIVED", status: 409 });
    const orderId = await insertProductionOrderInTransaction(tx, product, {
      productId: row.productId, quantity: Number(row.quantity), dueDate: row.dueDate, priority: row.priority as never, notes: `From plan ${plan.planNumber} line ${row.lineNo}${row.notes ? `: ${row.notes}` : ""}`,
    } as never, actorId);
    await tx.orm.public.ProductionPlanLine.where({ id: lineId }).update({ status: "RELEASED", productionOrderId: orderId });
    await recordAuditEvent({ actorId, action: "PRODUCTION_PLAN_LINE_RELEASED", entityType: "ProductionPlan", entityId: planId, metadata: { lineId, productionOrderId: orderId } }, tx);
  });
  return getPlan(planId);
}

export async function cancelPlanLine(planId: string, lineId: string, actorId: string) {
  const updated = await rows<{ id: string }>(db.runtime(), db.raw.sql`
    update erp_production_plan_lines set status = 'CANCELLED' where id = ${lineId}::uuid and "planId" = ${planId}::uuid and status = 'PLANNED' returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build());
  if (!updated.length) throw new AppError("Only lines not yet released can be cancelled.", { code: "PLAN_LINE_STATUS_CONFLICT", status: 409 });
  await recordAuditEvent({ actorId, action: "PRODUCTION_PLAN_LINE_CANCELLED", entityType: "ProductionPlan", entityId: planId, metadata: { lineId } });
  return getPlan(planId);
}

export async function getPlan(id: string) {
  if (!UUID.test(id)) throw new AppError("Plan not found.", { code: "PLAN_NOT_FOUND", status: 404 });
  const plan = await db.orm.public.ProductionPlan.where({ id }).first();
  if (!plan) throw new AppError("Plan not found.", { code: "PLAN_NOT_FOUND", status: 404 });
  const lines = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select l.id::text as id, l."lineNo"::text as "lineNo", l."productId"::text as "productId", p.sku, p.name as "productName", p.unit, l.quantity::text as quantity,
      l."dueDate", l.priority, l.status, coalesce(l.notes, '') as notes, coalesce(o.id::text, '') as "productionOrderId", coalesce(o."orderNumber", '') as "orderNumber",
      coalesce(o.status, '') as "orderStatus", coalesce(o."currentStage", '') as "currentStage"
    from erp_production_plan_lines l join erp_products p on p.id = l."productId" left join erp_production_orders o on o.id = l."productionOrderId"
    where l."planId" = ${id}::uuid order by l."lineNo"
  `.returnsRow({ id: "pg/text@1", lineNo: "pg/text@1", productId: "pg/text@1", sku: "pg/text@1", productName: "pg/text@1", unit: "pg/text@1", quantity: "pg/text@1", dueDate: "pg/text@1", priority: "pg/text@1", status: "pg/text@1", notes: "pg/text@1", productionOrderId: "pg/text@1", orderNumber: "pg/text@1", orderStatus: "pg/text@1", currentStage: "pg/text@1" }).build());
  // Capacity check: planned quantity per unit vs each stage's capacity over the plan's working days.
  const centers = await listWorkCenters();
  const days = (await workingDays(plan.periodStart, plan.periodEnd)).length;
  const active = lines.filter((line) => line.status !== "CANCELLED");
  const byUnit = new Map<string, number>();
  for (const line of active) byUnit.set(line.unit, (byUnit.get(line.unit) ?? 0) + Number(line.quantity));
  const capacity = centers.filter((center) => center.dailyCapacity && center.capacityUnit).map((center) => {
    const quantity = byUnit.get(center.capacityUnit!) ?? 0;
    const perDay = Number(center.dailyCapacity) * (center.shiftsPerDay ?? 1);
    const needed = quantity / perDay;
    return { stageKey: center.stageKey, label: center.label, unit: center.capacityUnit, quantity: normalizeDecimalString(String(quantity)), daysNeeded: Number(needed.toFixed(1)), daysAvailable: days, fits: needed <= days };
  });
  return {
    ...plan, workingDays: days,
    lines: lines.map((line) => ({ ...line, lineNo: Number(line.lineNo), quantity: dec(line.quantity), productionOrderId: line.productionOrderId || null, orderNumber: line.orderNumber || null })),
    capacity,
    unconfiguredStages: centers.filter((center) => !center.dailyCapacity).length,
  };
}

export async function listPlans(filters: { status: string; page: number; pageSize: number }) {
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select p.id::text as id, p."planNumber", p.title, p."periodStart", p."periodEnd", p.status,
      (select count(*) from erp_production_plan_lines l where l."planId" = p.id and l.status <> 'CANCELLED')::text as lines,
      (select count(*) from erp_production_plan_lines l where l."planId" = p.id and l.status = 'RELEASED')::text as released
    from erp_production_plans p
    where (${filters.status} = '' or p.status = ${filters.status})
    order by p."periodStart" desc, p."planNumber" desc
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", planNumber: "pg/text@1", title: "pg/text@1", periodStart: "pg/text@1", periodEnd: "pg/text@1", status: "pg/text@1", lines: "pg/text@1", released: "pg/text@1" }).build());
  return { plans: result.slice(0, filters.pageSize).map((row) => ({ ...row, lines: Number(row.lines), released: Number(row.released) })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

