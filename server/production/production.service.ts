/*
 * Production orders and the nine-stage workflow (rules: production-rules).
 *
 * Every write to a production order (runs, stage completion, status
 * changes) first locks the order row, so concurrent operators are
 * serialised and stage totals stay exact. Runs and events are append-only;
 * every change writes a ProductionEvent and an audit event in the same
 * transaction. Run submissions carry an idempotency key.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import {
  addDecimalStrings,
  decimalSign,
  multiplyDecimalStrings,
  normalizeDecimalString,
  toPlainDecimalString,
} from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import {
  FINAL_STAGE,
  STAGES,
  completionError,
  nextOrderStatus,
  runError,
  stageProgress,
  TAPE_STAGE_KEYS,
  stageInKg,
  stageQuantities,
  type StageTotals,
} from "./production-rules";
import { stageChecksFor } from "./stage-checks.service";
import type { ProductionOrderInput, ProductionQuery, StageRunInput } from "./production.validation";

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertOrderId(id: string) {
  if (!UUID.test(id)) {
    throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
  }
}

async function lockOrder(tx: Tx, id: string) {
  assertOrderId(id);
  const locked = (await tx.query(db.raw.sql`
    select status from erp_production_orders where id = ${id}::uuid for update
  `.returnsRow({ status: "pg/text@1" }).build() as never)) as unknown as Array<{ status: string }>;

  if (!locked.length) {
    throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
  }
}

async function logEvent(
  tx: Tx,
  productionOrderId: string,
  actorId: string,
  eventType: string,
  extra: { stageKey?: string; fromValue?: string | null; toValue?: string | null; details?: unknown } = {},
) {
  await tx.orm.public.ProductionEvent.create({
    productionOrderId,
    actorId,
    eventType,
    stageKey: extra.stageKey ?? null,
    fromValue: extra.fromValue ?? null,
    toValue: extra.toValue ?? null,
    details: extra.details === undefined ? null : JSON.stringify(extra.details),
  });
  await recordAuditEvent({
    actorId,
    action: `PRODUCTION_${eventType}`,
    entityType: "ProductionOrder",
    entityId: productionOrderId,
    metadata: { stageKey: extra.stageKey ?? null, from: extra.fromValue ?? null, to: extra.toValue ?? null },
  }, tx);
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

/*
 * Inserts a validated production order with its nine stages inside the
 * caller's transaction (used directly by production plans, D-034).
 */
/*
 * A production order made for an order line carries the order's own number
 * (D-048): AF7-26-0001-1 is line 1 of order AF7-26-0001; a line sent again
 * after a cancellation becomes AF7-26-0001-1.2. Other production orders
 * (stock, plans) keep their PRD serial.
 */
async function productionNumber(tx: Tx, input: ProductionOrderInput) {
  if (!input.salesOrderLineId) return allocateDocumentNumber(tx, "PRD");
  const line = await tx.orm.public.SalesOrderLine.where({ id: input.salesOrderLineId }).first();
  const sale = line ? await tx.orm.public.SalesOrder.where({ id: line.salesOrderId }).first() : null;
  if (!line?.lineNo || !sale) return allocateDocumentNumber(tx, "PRD");
  const base = `${sale.orderNumber}-${line.lineNo}`;
  const earlier = await tx.orm.public.ProductionOrder.where({ salesOrderLineId: line.id }).all();
  return earlier.length === 0 ? base : `${base}.${earlier.length + 1}`;
}

export async function insertProductionOrderInTransaction(
  tx: Tx,
  product: { id: string; unit: string },
  input: ProductionOrderInput,
  actorId: string,
) {
  const bom = await tx.orm.public.Bom.where({ productId: product.id, isActive: true }).first();
  const orderNumber = await productionNumber(tx, input);
  const order = await tx.orm.public.ProductionOrder.create({
    orderNumber,
    productId: product.id,
    quantity: toPlainDecimalString(input.quantity),
    unit: product.unit,
    salesOrderId: input.salesOrderId ?? null,
    salesOrderLineId: input.salesOrderLineId ?? null,
    plannedOrderId: input.plannedOrderId ?? null,
    bomId: bom?.id ?? null,
    bomRevision: bom?.revision ?? null,
    priority: input.priority,
    dueDate: input.dueDate || null,
    notes: input.notes || null,
    tapeKg: input.tapeKg === undefined ? null : toPlainDecimalString(input.tapeKg),
    currentStage: STAGES[0].key,
    createdBy: actorId,
  });

  for (const stage of STAGES) {
    await tx.orm.public.ProductionStage.create({
      productionOrderId: order.id,
      stageKey: stage.key,
      sequence: stage.sequence,
      department: stage.department,
    });
  }

  await logEvent(tx, order.id, actorId, "CREATED", {
    toValue: "PLANNED",
    details: { orderNumber, quantity: toPlainDecimalString(input.quantity), plannedOrderId: input.plannedOrderId ?? null },
  });
  return order.id;
}

export async function createProductionOrder(input: ProductionOrderInput, actorId: string) {
  const product = await db.orm.public.Product.where({ id: input.productId }).first();

  if (!product) {
    throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 400 });
  }
  if (product.status === "ARCHIVED") {
    throw new AppError(`${product.sku} is archived and cannot be produced.`, { code: "PRODUCT_ARCHIVED", status: 409 });
  }

  const precision = quantityPrecisionError(input.quantity, product.unit);
  if (precision) {
    throw new AppError(precision, { code: "QUANTITY_PRECISION", status: 400 });
  }

  if (input.plannedOrderId) {
    const planned = await db.orm.public.MrpPlannedOrder.where({ id: input.plannedOrderId }).first();
    if (!planned || planned.status !== "CONFIRMED" || planned.orderType !== "MAKE" || planned.productId !== input.productId) {
      throw new AppError("Only a confirmed MAKE planned order for this item can be converted.", {
        code: "PLANNED_ORDER_NOT_CONVERTIBLE",
        status: 409,
      });
    }
  }

  if (input.salesOrderId) {
    const order = await db.orm.public.SalesOrder.where({ id: input.salesOrderId }).first();
    if (!order || order.status !== "APPROVED") {
      throw new AppError("Production can only be linked to an approved sales order.", {
        code: "SALES_ORDER_NOT_APPROVED",
        status: 409,
      });
    }
  }

  try {
    const id = await db.transaction((tx) => insertProductionOrderInTransaction(tx, product, input, actorId));

    return getProductionOrder(id);
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("plannedOrderId")) {
      throw new AppError("This planned order has already been converted to a production order.", {
        code: "PLANNED_ORDER_ALREADY_CONVERTED",
        status: 409,
      });
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

function stageTotals(stage: Record<string, unknown>): StageTotals {
  return {
    sequence: Number(stage.sequence),
    status: String(stage.status),
    processedQuantity: dec(stage.processedQuantity),
    acceptedQuantity: dec(stage.acceptedQuantity),
    rejectedQuantity: dec(stage.rejectedQuantity),
    wastageQuantity: dec(stage.wastageQuantity),
    reworkQuantity: dec(stage.reworkQuantity),
  };
}

export async function getProductionOrder(id: string) {
  assertOrderId(id);
  const order = await db.orm.public.ProductionOrder.where({ id }).first();

  if (!order) {
    throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
  }

  const stages = await db.orm.public.ProductionStage.where({ productionOrderId: id }).orderBy((row) => row.sequence.asc()).all();
  const stageIds = stages.map((stage) => stage.id);
  const runs = stageIds.length
    ? await db.orm.public.ProductionStageRun.where((run) => run.stageId.in(stageIds)).orderBy((run) => run.recordedAt.asc()).all()
    : [];
  const events = await db.orm.public.ProductionEvent.where({ productionOrderId: id }).orderBy((event) => event.createdAt.asc()).all();
  const product = await db.orm.public.Product.where({ id: order.productId }).first();
  const salesOrder = order.salesOrderId ? await db.orm.public.SalesOrder.where({ id: order.salesOrderId }).first() : null;
  const issues = await db.orm.public.StockDocument
    .where({ sourceType: "ProductionOrder", sourceId: id })
    .orderBy((document) => document.postedAt.asc())
    .all();

  const actorIds = [...new Set([...events.map((event) => event.actorId), ...runs.map((run) => run.recordedBy)])];
  const actors = actorIds.length ? await db.orm.public.User.where((user) => user.id.in(actorIds)).select("id", "name").all() : [];
  const actorName = new Map(actors.map((actor) => [actor.id, actor.name]));
  const totals = stages.map((stage) => stageTotals(stage as unknown as Record<string, unknown>));
  const quantity = dec(order.quantity);

  // Material requirement from the BOM revision recorded on the order.
  let materials: Array<Record<string, unknown>> = [];
  if (order.bomId) {
    const lines = await db.orm.public.BomLine.where({ bomId: order.bomId }).orderBy((line) => line.lineNo.asc()).all();
    const components = lines.length
      ? await db.orm.public.Product.where((item) => item.id.in(lines.map((line) => line.componentId))).all()
      : [];
    const byId = new Map(components.map((item) => [item.id, item]));
    materials = lines.map((line) => {
      const factor = addDecimalStrings("1", multiplyDecimalStrings(dec(line.scrapPercent), "0.01"));
      return {
        componentId: line.componentId,
        sku: byId.get(line.componentId)?.sku ?? null,
        productName: byId.get(line.componentId)?.name ?? null,
        unit: byId.get(line.componentId)?.unit ?? null,
        perUnit: dec(line.quantity),
        scrapPercent: dec(line.scrapPercent),
        required: normalizeDecimalString(multiplyDecimalStrings(multiplyDecimalStrings(quantity, dec(line.quantity)), factor)),
      };
    });
  }

  const checksOf = await stageChecksFor(order.id);

  return {
    ...order,
    quantity,
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    salesOrderNumber: salesOrder?.orderNumber ?? null,
    progress: stageProgress(totals),
    deliveredQuantity: totals.find((stage) => stage.sequence === FINAL_STAGE.sequence)?.acceptedQuantity ?? "0",
    stages: stages.map((stage, index) => {
      const definition = STAGES[index];
      const quantities = stageQuantities(totals, quantity, stage.sequence, order.tapeKg ? dec(order.tapeKg) : null);
      return {
        ...totals[index],
        id: stage.id,
        stageKey: stage.stageKey,
        label: definition.label,
        department: stage.department,
        managedBy: stageManagedBy(stage.stageKey, order.salesOrderId),
        received: quantities.received,
        available: quantities.available,
        previousCompleted: quantities.previousCompleted,
        unit: quantities.inKg ? "Kg" : order.unit,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        completionNote: stage.completionNote ?? null,
        checks: stageManagedBy(stage.stageKey, order.salesOrderId) ? null : checksOf(stage.stageKey),
        runs: runs.filter((run) => run.stageId === stage.id).map((run) => ({
          id: run.id,
          runNo: run.runNo,
          inputQuantity: dec(run.inputQuantity),
          acceptedQuantity: dec(run.acceptedQuantity),
          rejectedQuantity: dec(run.rejectedQuantity),
          wastageQuantity: dec(run.wastageQuantity),
          reworkQuantity: dec(run.reworkQuantity),
          operatorName: run.operatorName,
          workstation: run.workstation,
          remarks: run.remarks,
          recordedBy: actorName.get(run.recordedBy) ?? null,
          recordedAt: run.recordedAt,
        })),
      };
    }),
    events: events.map((event) => ({
      ...event,
      actorName: actorName.get(event.actorId) ?? null,
      details: event.details ? JSON.parse(event.details) : null,
    })),
    materials,
    materialIssues: issues.map((document) => ({
      id: document.id,
      documentNumber: document.documentNumber,
      documentType: document.documentType,
      postedAt: document.postedAt,
    })),
  };
}

export async function listProductionOrders(filters: ProductionQuery) {
  let query = db.orm.public.ProductionOrder;

  if (filters.status === "ACTIVE") {
    query = query.where((order) => order.status.in(["RELEASED", "IN_PROGRESS", "ON_HOLD"]));
  } else if (filters.status === "OPEN") {
    query = query.where((order) => order.status.in(["PLANNED", "RELEASED", "IN_PROGRESS", "ON_HOLD"]));
  } else if (filters.status) {
    query = query.where({ status: filters.status });
  }
  if (filters.stage) {
    query = query.where({ currentStage: filters.stage });
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const products = await db.orm.public.Product
      .where((product) => or(product.sku.ilike(pattern), product.name.ilike(pattern)))
      .select("id")
      .all();
    const ids = products.map((product) => product.id);
    query = query.where((order) => (ids.length
      ? or(order.orderNumber.ilike(pattern), order.productId.in(ids))
      : order.orderNumber.ilike(pattern)));
  }

  // "due": earliest due date first, undated orders last, then oldest first.
  const ordered = filters.sort === "due"
    ? query.orderBy([(order) => order.dueDate.asc({ nulls: "last" }), (order) => order.createdAt.asc()])
    : query.orderBy((order) => order.createdAt.desc());
  const result = await ordered
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const products = page.length
    ? await db.orm.public.Product.where((product) => product.id.in([...new Set(page.map((order) => order.productId))])).all()
    : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  const stages = page.length
    ? await db.orm.public.ProductionStage.where((stage) => stage.productionOrderId.in(page.map((order) => order.id))).select("productionOrderId", "status", "sequence", "acceptedQuantity").all()
    : [];

  return {
    orders: page.map((order) => {
      const own = stages.filter((stage) => stage.productionOrderId === order.id);
      return {
        ...order,
        quantity: dec(order.quantity),
        sku: byId.get(order.productId)?.sku ?? null,
        productName: byId.get(order.productId)?.name ?? null,
        progress: stageProgress(own),
        deliveredQuantity: dec(own.find((stage) => stage.sequence === FINAL_STAGE.sequence)?.acceptedQuantity),
      };
    }),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* ------------------------------------------------------------------ */
/* Status changes                                                      */
/* ------------------------------------------------------------------ */

export async function changeProductionStatus(id: string, action: string, reason: string, actorId: string) {
  await db.transaction(async (tx) => {
    await lockOrder(tx, id);
    const order = await tx.orm.public.ProductionOrder.where({ id }).first();
    const next = nextOrderStatus(action, order!.status, order!.holdFromStatus);

    if (!next) {
      throw new AppError(`A ${order!.status.toLowerCase().replace("_", " ")} order cannot be ${action === "hold" ? "put on hold" : `${action}d`}.`, {
        code: "PRODUCTION_STATUS_CONFLICT",
        status: 409,
      });
    }

    await tx.orm.public.ProductionOrder.where({ id }).update({
      status: next,
      holdFromStatus: action === "hold" ? order!.status : null,
      updatedAt: new Date().toISOString(),
    });
    await logEvent(tx, id, actorId, `STATUS_${action.toUpperCase()}`, {
      fromValue: order!.status,
      toValue: next,
      details: reason ? { reason } : undefined,
    });
  });

  return getProductionOrder(id);
}

/* ------------------------------------------------------------------ */
/* Stage runs and completion                                           */
/* ------------------------------------------------------------------ */

/*
 * Stages 7-9 are driven by the modules that own them (D-022): quality
 * check by approved final inspections, packing by confirmed packing lists,
 * and Delivered by shipment delivery when the order is for a sales order.
 * Make-to-stock orders record Delivered (handover to stock) by hand.
 */
export type RunSource = "manual" | "quality" | "packing" | "dispatch";

const MANAGED_STAGE_MESSAGES: Record<string, string> = {
  quality: "Quality check results are recorded by approving a final inspection (Quality → Final inspection).",
  packing: "Packing is recorded by confirming a packing list (Packing → Packing orders).",
  dispatch: "Delivery for a sales order is recorded by confirming the shipment's delivery (Dispatch).",
};

export function stageManagedBy(stageKey: string, salesOrderId: string | null | undefined): RunSource | null {
  if (stageKey === "quality-check") return "quality";
  if (stageKey === "packing") return "packing";
  if (stageKey === FINAL_STAGE.key && salesOrderId) return "dispatch";
  return null;
}

/*
 * Records one stage run inside the caller's transaction, after locking the
 * order row. Quality, packing and dispatch call this so the run commits
 * atomically with their own records.
 */
export async function recordStageRunInTransaction(
  tx: Tx,
  id: string,
  stageKey: string,
  input: StageRunInput,
  actorId: string,
  source: RunSource,
) {
  const run = {
    inputQuantity: toPlainDecimalString(input.inputQuantity),
    acceptedQuantity: toPlainDecimalString(input.acceptedQuantity),
    rejectedQuantity: toPlainDecimalString(input.rejectedQuantity ?? 0),
    wastageQuantity: toPlainDecimalString(input.wastageQuantity ?? 0),
    reworkQuantity: toPlainDecimalString(input.reworkQuantity ?? 0),
  };

  await lockOrder(tx, id);
  const order = await tx.orm.public.ProductionOrder.where({ id }).first();
  // Tape stages of an order with a tape weight are in kilograms (3 decimals).
  const sequence = STAGES.find((item) => item.key === stageKey)?.sequence ?? 0;
  const runUnit = stageInKg(sequence, order?.tapeKg ? dec(order.tapeKg) : null) ? "Kgs" : order!.unit;
  const precision = [input.inputQuantity, input.acceptedQuantity, input.rejectedQuantity, input.wastageQuantity, input.reworkQuantity]
    .map((value) => quantityPrecisionError(value ?? 0, runUnit))
    .find(Boolean);
  if (precision) {
    throw new AppError(precision, { code: "QUANTITY_PRECISION", status: 400 });
  }

  const stages = await tx.orm.public.ProductionStage.where({ productionOrderId: id }).orderBy((row) => row.sequence.asc()).all();
  const totals = stages.map((stage) => stageTotals(stage as unknown as Record<string, unknown>));
  const stage = stages.find((item) => item.stageKey === stageKey)!;
  const managedBy = stageManagedBy(stageKey, order!.salesOrderId);
  if (managedBy && managedBy !== source) {
    throw new AppError(MANAGED_STAGE_MESSAGES[managedBy], { code: "STAGE_MANAGED_ELSEWHERE", status: 409 });
  }
  const quantities = stageQuantities(totals, dec(order!.quantity), stage.sequence, order!.tapeKg ? dec(order!.tapeKg) : null);
  const problem = runError(run, { available: quantities.available, stageStatus: stage.status, orderStatus: order!.status });

  if (problem) {
    throw new AppError(problem, { code: "STAGE_RUN_INVALID", status: 409, details: { available: quantities.available } });
  }

  const previousRuns = await tx.orm.public.ProductionStageRun.where({ stageId: stage.id }).select("id").all();
  await tx.orm.public.ProductionStageRun.create({
    stageId: stage.id,
    runNo: previousRuns.length + 1,
    ...run,
    operatorName: input.operatorName || null,
    workstation: input.workstation || null,
    remarks: input.remarks || null,
    idempotencyKey: input.idempotencyKey,
    recordedBy: actorId,
  });

  const current = totals.find((item) => item.sequence === stage.sequence)!;
  await tx.orm.public.ProductionStage.where({ id: stage.id }).update({
    status: "IN_PROGRESS",
    processedQuantity: addDecimalStrings(current.processedQuantity, run.inputQuantity),
    acceptedQuantity: addDecimalStrings(current.acceptedQuantity, run.acceptedQuantity),
    rejectedQuantity: addDecimalStrings(current.rejectedQuantity, run.rejectedQuantity),
    wastageQuantity: addDecimalStrings(current.wastageQuantity, run.wastageQuantity),
    reworkQuantity: addDecimalStrings(current.reworkQuantity, run.reworkQuantity),
    startedAt: stage.startedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (order!.status === "RELEASED") {
    await tx.orm.public.ProductionOrder.where({ id }).update({ status: "IN_PROGRESS", updatedAt: new Date().toISOString() });
    await logEvent(tx, id, actorId, "STATUS_STARTED", { fromValue: "RELEASED", toValue: "IN_PROGRESS" });
  }

  await logEvent(tx, id, actorId, "STAGE_RUN_RECORDED", {
    stageKey,
    details: { ...run, operatorName: input.operatorName || null, workstation: input.workstation || null, source },
  });
}

export async function recordStageRun(id: string, stageKey: string, input: StageRunInput, actorId: string) {
  const replay = await db.orm.public.ProductionStageRun.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) {
    return { order: await getProductionOrder(id), replayed: true };
  }

  try {
    await db.transaction((tx) => recordStageRunInTransaction(tx, id, stageKey, input, actorId, "manual"));
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("idempotencyKey")) {
      return { order: await getProductionOrder(id), replayed: true };
    }
    throw error;
  }

  return { order: await getProductionOrder(id), replayed: false };
}

export async function completeStage(id: string, stageKey: string, actorId: string, note?: string) {
  await db.transaction(async (tx) => {
    await lockOrder(tx, id);
    const order = await tx.orm.public.ProductionOrder.where({ id }).first();

    if (!["RELEASED", "IN_PROGRESS"].includes(order!.status)) {
      throw new AppError(`Stages cannot be completed while the order is ${order!.status.toLowerCase().replace("_", " ")}.`, {
        code: "PRODUCTION_STATUS_CONFLICT",
        status: 409,
      });
    }

    const stages = await tx.orm.public.ProductionStage.where({ productionOrderId: id }).orderBy((row) => row.sequence.asc()).all();
    const totals = stages.map((stage) => stageTotals(stage as unknown as Record<string, unknown>));
    const stage = stages.find((item) => item.stageKey === stageKey)!;
    const problem = completionError(stageQuantities(totals, dec(order!.quantity), stage.sequence, order!.tapeKg ? dec(order!.tapeKg) : null), stage.status);

    if (problem) {
      throw new AppError(problem, { code: "STAGE_NOT_COMPLETABLE", status: 409 });
    }

    const now = new Date().toISOString();
    const completionNote = note?.trim() || null;
    await tx.orm.public.ProductionStage.where({ id: stage.id }).update({ status: "COMPLETED", completedAt: now, updatedAt: now, ...(completionNote ? { completionNote } : {}) });
    await logEvent(tx, id, actorId, "STAGE_COMPLETED", { stageKey, toValue: "COMPLETED", ...(completionNote ? { details: { note: completionNote } } : {}) });

    const next = STAGES.find((item) => item.sequence === stage.sequence + 1);

    if (next) {
      await tx.orm.public.ProductionOrder.where({ id }).update({ currentStage: next.key, updatedAt: now });
      await logEvent(tx, id, actorId, "STAGE_ADVANCED", { fromValue: stageKey, toValue: next.key });
    } else {
      // Final stage (Delivered) completed: the order is complete.
      await tx.orm.public.ProductionOrder.where({ id }).update({ status: "COMPLETED", completedAt: now, updatedAt: now });
      await logEvent(tx, id, actorId, "STATUS_COMPLETED", { fromValue: order!.status, toValue: "COMPLETED" });
    }
  });

  return getProductionOrder(id);
}

/*
 * The simple production board (requirements 1.2): a stage is only started
 * and completed. Start stamps the start time. Complete records the whole
 * remaining quantity as accepted and closes the stage, so the next stage
 * receives everything. Tape Dyeing's "Total Qty" is the tape weight in kg,
 * entered with its completion when the order did not carry one. Stages run
 * by Quality, Packing and Dispatch stay with those screens.
 */
export async function startStage(id: string, stageKey: string, actorId: string) {
  await db.transaction(async (tx) => {
    await lockOrder(tx, id);
    const order = await tx.orm.public.ProductionOrder.where({ id }).first();
    if (!["RELEASED", "IN_PROGRESS"].includes(order!.status)) {
      throw new AppError(`A stage cannot be started while the order is ${order!.status.toLowerCase().replace("_", " ")}. Release it first.`, { code: "PRODUCTION_STATUS_CONFLICT", status: 409 });
    }
    const stages = await tx.orm.public.ProductionStage.where({ productionOrderId: id }).orderBy((row) => row.sequence.asc()).all();
    const stage = stages.find((item) => item.stageKey === stageKey);
    if (!stage) throw new AppError("Unknown stage.", { code: "STAGE_NOT_FOUND", status: 404 });
    if (stage.status !== "PENDING") throw new AppError("This stage has already started.", { code: "STAGE_STATUS_CONFLICT", status: 409 });
    const now = new Date().toISOString();
    await tx.orm.public.ProductionStage.where({ id: stage.id }).update({ status: "IN_PROGRESS", startedAt: now, updatedAt: now });
    await logEvent(tx, id, actorId, "STAGE_STARTED", { stageKey, toValue: "IN_PROGRESS" });
    if (order!.status === "RELEASED") {
      await tx.orm.public.ProductionOrder.where({ id }).update({ status: "IN_PROGRESS", updatedAt: now });
      await logEvent(tx, id, actorId, "STATUS_STARTED", { fromValue: "RELEASED", toValue: "IN_PROGRESS" });
    }
  });
  return getProductionOrder(id);
}

/* A fixed key per order and stage, so a double click records the run once. */
function completionKey(id: string, stageKey: string) {
  return `simple-complete:${id}:${stageKey}`;
}

export async function finishStage(id: string, stageKey: string, input: { totalQuantity?: number; note?: string }, actorId: string) {
  const order = await db.orm.public.ProductionOrder.where({ id }).first();
  if (!order) throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 404 });
  const managedBy = stageManagedBy(stageKey, order.salesOrderId);
  if (managedBy) throw new AppError(MANAGED_STAGE_MESSAGES[managedBy], { code: "STAGE_MANAGED_ELSEWHERE", status: 409 });

  // The tape weight is optional (D-048): without it the tape stages count pieces.
  if (stageKey === TAPE_STAGE_KEYS[0] && !order.tapeKg && input.totalQuantity && input.totalQuantity > 0) {
    const precision = quantityPrecisionError(input.totalQuantity, "Kgs");
    if (precision) throw new AppError(precision, { code: "QUANTITY_PRECISION", status: 400 });
    await db.transaction(async (tx) => {
      await lockOrder(tx, id);
      const runs = await tx.orm.public.ProductionStage.where({ productionOrderId: id, stageKey }).first();
      if (runs && decimalSign(dec(runs.processedQuantity)) > 0) {
        throw new AppError("Tape Dyeing already has recorded output; its total cannot change.", { code: "TAPE_QUANTITY_LOCKED", status: 409 });
      }
      await tx.orm.public.ProductionOrder.where({ id }).update({ tapeKg: toPlainDecimalString(input.totalQuantity!), updatedAt: new Date().toISOString() });
      await logEvent(tx, id, actorId, "TAPE_WEIGHT_SET", { stageKey, toValue: toPlainDecimalString(input.totalQuantity!) });
    });
  }

  const current = await getProductionOrder(id);
  const stage = current.stages.find((item: { stageKey: string }) => item.stageKey === stageKey);
  if (!stage) throw new AppError("Unknown stage.", { code: "STAGE_NOT_FOUND", status: 404 });
  if (stage.status === "COMPLETED") return current;
  if (decimalSign(String(stage.available)) > 0) {
    const quantity = Number(stage.available);
    await recordStageRun(id, stageKey, { idempotencyKey: completionKey(id, stageKey), inputQuantity: quantity, acceptedQuantity: quantity, rejectedQuantity: 0, wastageQuantity: 0, reworkQuantity: 0 }, actorId);
  }
  return completeStage(id, stageKey, actorId, input.note);
}

/* Counts for the production dashboard and stage board, straight from the tables. */
export async function getProductionSummary(today: string) {
  const byStatus = (await db.runtime().query(db.raw.sql`
    select status, count(*)::text as count from erp_production_orders group by status
  `.returnsRow({ status: "pg/text@1", count: "pg/text@1" }).build() as never)) as unknown as Array<{ status: string; count: string }>;
  const byStage = (await db.runtime().query(db.raw.sql`
    select "currentStage" as stage, count(*)::text as count, coalesce(sum(quantity), 0)::text as quantity
    from erp_production_orders where status in ('RELEASED', 'IN_PROGRESS', 'ON_HOLD')
    group by "currentStage"
  `.returnsRow({ stage: "pg/text@1", count: "pg/text@1", quantity: "pg/text@1" }).build() as never)) as unknown as Array<{ stage: string; count: string; quantity: string }>;
  const overdue = (await db.runtime().query(db.raw.sql`
    select count(*)::text as count from erp_production_orders
    where status in ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD') and "dueDate" is not null and "dueDate" < ${today}
  `.returnsRow({ count: "pg/text@1" }).build() as never)) as unknown as Array<{ count: string }>;
  const losses = (await db.runtime().query(db.raw.sql`
    select s."stageKey" as stage,
      coalesce(sum(s."processedQuantity"), 0)::text as processed,
      coalesce(sum(s."rejectedQuantity"), 0)::text as rejected,
      coalesce(sum(s."wastageQuantity"), 0)::text as wastage
    from erp_production_stages s
    join erp_production_orders o on o.id = s."productionOrderId"
    where o.status <> 'CANCELLED'
    group by s."stageKey"
  `.returnsRow({ stage: "pg/text@1", processed: "pg/text@1", rejected: "pg/text@1", wastage: "pg/text@1" }).build() as never)) as unknown as Array<{ stage: string; processed: string; rejected: string; wastage: string }>;

  return {
    statusCounts: Object.fromEntries(byStatus.map((row) => [row.status, Number(row.count)])),
    stages: STAGES.map((stage) => {
      const active = byStage.find((row) => row.stage === stage.key);
      const loss = losses.find((row) => row.stage === stage.key);
      return {
        key: stage.key,
        label: stage.label,
        activeOrders: Number(active?.count ?? 0),
        processed: dec(loss?.processed),
        rejected: dec(loss?.rejected),
        wastage: dec(loss?.wastage),
      };
    }),
    overdue: Number(overdue[0]?.count ?? 0),
  };
}
