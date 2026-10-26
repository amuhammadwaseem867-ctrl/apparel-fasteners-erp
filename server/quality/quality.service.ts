/*
 * Quality inspections (D-022).
 *
 * An inspection is recorded with its results (OPEN) and then approved or
 * cancelled once. Approval applies the results in the same transaction:
 *   INCOMING   passed -> QC_RELEASE, rejected -> QC_REJECT (rework stays on hold)
 *   FINAL      the production order's quality-check stage run
 *   IN_PROCESS results and defects only (a sampling record)
 * The OPEN -> decided transition is a compare-and-set, so concurrent
 * approvals apply the results exactly once.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { decimalSign, normalizeDecimalString, toPlainDecimalString, compareDecimalStrings } from "../core/utils/decimal";
import { allocateDocumentNumber, postStockDocumentInTransaction } from "../inventory/inventory.service";
import { quantityPrecisionError } from "../inventory/stock-rules";
import { STAGES, stageQuantities, type StageTotals } from "../production/production-rules";
import { recordStageRunInTransaction } from "../production/production.service";
import type { InspectionInput, InspectionQuery } from "./quality.validation";

const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QC_STAGE = "quality-check";
const QC_SEQUENCE = STAGES.find((stage) => stage.key === QC_STAGE)!.sequence;

function notFound(): never {
  throw new AppError("Inspection not found.", { code: "INSPECTION_NOT_FOUND", status: 404 });
}

async function heldQuantity(productId: string, locationId: string) {
  const balance = await db.orm.public.StockBalance.where({ productId, locationId }).first();
  return dec(balance?.qualityHold);
}

async function qcStageAvailable(productionOrderId: string) {
  const order = await db.orm.public.ProductionOrder.where({ id: productionOrderId }).first();
  const stages = await db.orm.public.ProductionStage.where({ productionOrderId }).all();
  const totals: StageTotals[] = stages.map((stage) => ({
    sequence: stage.sequence,
    status: stage.status,
    processedQuantity: dec(stage.processedQuantity),
    acceptedQuantity: dec(stage.acceptedQuantity),
    rejectedQuantity: dec(stage.rejectedQuantity),
    wastageQuantity: dec(stage.wastageQuantity),
    reworkQuantity: dec(stage.reworkQuantity),
  }));
  return stageQuantities(totals, dec(order?.quantity), QC_SEQUENCE).available;
}

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

export async function createInspection(input: InspectionInput, actorId: string) {
  const replay = await db.orm.public.QualityInspection.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getInspection(replay.id);

  let productId = input.productId ?? "";
  let stageKey: string | null = null;
  const inspected = toPlainDecimalString(input.inspectedQuantity);

  if (input.inspectionType === "INCOMING") {
    const location = await db.orm.public.StorageLocation.where({ id: input.locationId! }).first();
    if (!location) {
      throw new AppError("Storage location not found.", { code: "LOCATION_NOT_FOUND", status: 400 });
    }
    const held = await heldQuantity(productId, location.id);
    if (compareDecimalStrings(inspected, held) > 0) {
      throw new AppError(`Only ${held} of this item is on quality hold at that location. Put stock on hold (Inventory → Quality Hold) before inspecting it.`, {
        code: "INSPECTION_EXCEEDS_HOLD",
        status: 409,
      });
    }
  } else {
    const order = await db.orm.public.ProductionOrder.where({ id: input.productionOrderId! }).first();
    if (!order) {
      throw new AppError("Production order not found.", { code: "PRODUCTION_ORDER_NOT_FOUND", status: 400 });
    }
    if (!["RELEASED", "IN_PROGRESS", "COMPLETED"].includes(order.status)) {
      throw new AppError("A planned, held or cancelled production order cannot be inspected; release or resume it first.", { code: "PRODUCTION_ORDER_NOT_OPEN", status: 409 });
    }
    productId = order.productId;

    if (input.inspectionType === "FINAL") {
      stageKey = QC_STAGE;
      const available = await qcStageAvailable(order.id);
      if (compareDecimalStrings(inspected, available) > 0) {
        throw new AppError(`Only ${available} is waiting at Quality Check for this order.`, { code: "INSPECTION_EXCEEDS_AVAILABLE", status: 409 });
      }
    } else {
      const stage = STAGES.find((item) => item.key === input.stageKey);
      if (!stage || stage.sequence >= QC_SEQUENCE) {
        throw new AppError("In-process inspections cover the stages before Quality Check.", { code: "STAGE_NOT_INSPECTABLE", status: 400 });
      }
      stageKey = stage.key;
    }
  }

  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) {
    throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 400 });
  }
  const precision = [input.inspectedQuantity, input.passedQuantity, input.reworkQuantity, input.rejectedQuantity]
    .map((value) => quantityPrecisionError(value ?? 0, product.unit))
    .find(Boolean);
  if (precision) {
    throw new AppError(precision, { code: "QUANTITY_PRECISION", status: 400 });
  }

  try {
    const id = await db.transaction(async (tx) => {
      const inspectionNumber = await allocateDocumentNumber(tx, "QCI");
      const created = await tx.orm.public.QualityInspection.create({
        inspectionNumber,
        inspectionType: input.inspectionType,
        productId,
        productionOrderId: input.inspectionType === "INCOMING" ? null : input.productionOrderId!,
        stageKey,
        locationId: input.inspectionType === "INCOMING" ? input.locationId! : null,
        inspectedQuantity: inspected,
        passedQuantity: toPlainDecimalString(input.passedQuantity),
        reworkQuantity: toPlainDecimalString(input.reworkQuantity ?? 0),
        rejectedQuantity: toPlainDecimalString(input.rejectedQuantity ?? 0),
        sampleSize: input.sampleSize ?? null,
        defects: input.defects.length ? JSON.stringify(input.defects) : null,
        inspectorName: input.inspectorName || null,
        remarks: input.remarks || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      await recordAuditEvent({
        actorId,
        action: "QUALITY_INSPECTION_RECORDED",
        entityType: "QualityInspection",
        entityId: created.id,
        metadata: { inspectionNumber, inspectionType: input.inspectionType, inspected },
      }, tx);
      return created.id;
    });
    return getInspection(id);
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("idempotencyKey")) {
      const original = await db.orm.public.QualityInspection.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getInspection(original.id);
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Decide                                                              */
/* ------------------------------------------------------------------ */

export async function decideInspection(id: string, action: "approve" | "cancel", note: string, actorId: string) {
  if (!UUID.test(id)) notFound();

  await db.transaction(async (tx) => {
    const status = action === "approve" ? "APPROVED" : "CANCELLED";
    const claimed = (await tx.query(db.raw.sql`
      update erp_quality_inspections
        set status = ${status}, "decidedBy" = ${actorId}::uuid, "decidedAt" = now(), "decisionNote" = ${note}
      where id = ${id}::uuid and status = 'OPEN'
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build() as never)) as unknown as Array<{ id: string }>;

    if (!claimed.length) {
      const existing = await tx.orm.public.QualityInspection.where({ id }).first();
      if (!existing) notFound();
      throw new AppError(`This inspection is already ${existing.status.toLowerCase()}.`, { code: "INSPECTION_STATUS_CONFLICT", status: 409 });
    }

    const inspection = (await tx.orm.public.QualityInspection.where({ id }).first())!;

    if (action === "approve") {
      const passed = dec(inspection.passedQuantity);
      const rework = dec(inspection.reworkQuantity);
      const rejected = dec(inspection.rejectedQuantity);

      if (inspection.inspectionType === "FINAL") {
        await recordStageRunInTransaction(tx, inspection.productionOrderId!, QC_STAGE, {
          idempotencyKey: `qci-${id}`,
          inputQuantity: Number(dec(inspection.inspectedQuantity)),
          acceptedQuantity: Number(passed),
          reworkQuantity: Number(rework),
          rejectedQuantity: Number(rejected),
          wastageQuantity: 0,
          operatorName: inspection.inspectorName ?? "",
          workstation: "",
          remarks: `Final inspection ${inspection.inspectionNumber}`,
        }, actorId, "quality");
      }

      if (inspection.inspectionType === "INCOMING") {
        const line = { productId: inspection.productId, locationId: inspection.locationId! };
        const common = { reference: inspection.inspectionNumber, notes: "", sourceType: "QualityInspection", sourceId: id };
        if (decimalSign(passed) > 0) {
          await postStockDocumentInTransaction(tx, {
            ...common,
            documentType: "QC_RELEASE",
            idempotencyKey: `qci-release-${id}`,
            reason: "",
            lines: [{ ...line, quantity: Number(passed) }],
          }, actorId);
        }
        if (decimalSign(rejected) > 0) {
          await postStockDocumentInTransaction(tx, {
            ...common,
            documentType: "QC_REJECT",
            idempotencyKey: `qci-reject-${id}`,
            reason: `Rejected in incoming inspection ${inspection.inspectionNumber}${note ? `: ${note}` : ""}`,
            lines: [{ ...line, quantity: Number(rejected) }],
          }, actorId);
        }
      }
    }

    await recordAuditEvent({
      actorId,
      action: action === "approve" ? "QUALITY_INSPECTION_APPROVED" : "QUALITY_INSPECTION_CANCELLED",
      entityType: "QualityInspection",
      entityId: id,
      metadata: { inspectionNumber: inspection.inspectionNumber, note: note || null },
    }, tx);
  });

  return getInspection(id);
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

async function describe(rows: Array<{ productId: string; productionOrderId: string | null; locationId: string | null; createdBy: string; decidedBy: string | null }>) {
  const ids = (pick: (row: (typeof rows)[number]) => string | null) => [...new Set(rows.map(pick).filter(Boolean) as string[])];
  const [products, orders, locations, users] = await Promise.all([
    ids((row) => row.productId).length ? db.orm.public.Product.where((item) => item.id.in(ids((row) => row.productId))).all() : [],
    ids((row) => row.productionOrderId).length ? db.orm.public.ProductionOrder.where((item) => item.id.in(ids((row) => row.productionOrderId))).all() : [],
    ids((row) => row.locationId).length ? db.orm.public.StorageLocation.where((item) => item.id.in(ids((row) => row.locationId))).all() : [],
    ids((row) => row.createdBy).concat(ids((row) => row.decidedBy)).length
      ? db.orm.public.User.where((item) => item.id.in([...ids((row) => row.createdBy), ...ids((row) => row.decidedBy)])).select("id", "name").all()
      : [],
  ]);
  const warehouses = locations.length
    ? await db.orm.public.Warehouse.where((item) => item.id.in([...new Set(locations.map((location) => location.warehouseId))])).all()
    : [];
  return {
    product: new Map(products.map((item) => [item.id, item])),
    order: new Map(orders.map((item) => [item.id, item])),
    location: new Map(locations.map((item) => [item.id, `${warehouses.find((w) => w.id === item.warehouseId)?.code ?? "?"}/${item.code}`])),
    user: new Map(users.map((item) => [item.id, item.name])),
  };
}

function present(row: Record<string, unknown> & { productId: string; productionOrderId: string | null; locationId: string | null; createdBy: string; decidedBy: string | null; stageKey: string | null }, lookup: Awaited<ReturnType<typeof describe>>) {
  const product = lookup.product.get(row.productId);
  return {
    ...row,
    inspectedQuantity: dec(row.inspectedQuantity),
    passedQuantity: dec(row.passedQuantity),
    reworkQuantity: dec(row.reworkQuantity),
    rejectedQuantity: dec(row.rejectedQuantity),
    defects: row.defects ? JSON.parse(String(row.defects)) : [],
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    unit: product?.unit ?? null,
    orderNumber: row.productionOrderId ? lookup.order.get(row.productionOrderId)?.orderNumber ?? null : null,
    stageLabel: STAGES.find((stage) => stage.key === row.stageKey)?.label ?? null,
    locationLabel: row.locationId ? lookup.location.get(row.locationId) ?? null : null,
    createdByName: lookup.user.get(row.createdBy) ?? null,
    decidedByName: row.decidedBy ? lookup.user.get(row.decidedBy) ?? null : null,
  };
}

export async function getInspection(id: string) {
  if (!UUID.test(id)) notFound();
  const row = await db.orm.public.QualityInspection.where({ id }).first();
  if (!row) notFound();
  const documents = await db.orm.public.StockDocument.where({ sourceType: "QualityInspection", sourceId: id }).all();
  return {
    ...present(row as never, await describe([row])),
    stockDocuments: documents.map((document) => ({ id: document.id, documentNumber: document.documentNumber, documentType: document.documentType })),
  };
}

export async function listInspections(filters: InspectionQuery) {
  let query = db.orm.public.QualityInspection;
  if (filters.inspectionType) query = query.where({ inspectionType: filters.inspectionType });
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.productionOrderId) query = query.where({ productionOrderId: filters.productionOrderId });
  if (filters.failedOnly === "true") {
    query = query.where((row) => or(row.rejectedQuantity.gt("0"), row.reworkQuantity.gt("0")));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const products = await db.orm.public.Product.where((product) => or(product.sku.ilike(pattern), product.name.ilike(pattern))).select("id").all();
    const productIds = products.map((product) => product.id);
    query = query.where((row) => (productIds.length
      ? or(row.inspectionNumber.ilike(pattern), row.productId.in(productIds))
      : row.inspectionNumber.ilike(pattern)));
  }

  const result = await query
    .orderBy((row) => row.createdAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const lookup = await describe(page);

  return {
    inspections: page.map((row) => present(row as never, lookup)),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* Counts for the quality overview. */
export async function getQualitySummary() {
  const rows = (await db.runtime().query(db.raw.sql`
    select "inspectionType" as type, status, count(*)::text as count,
      coalesce(sum("inspectedQuantity"), 0)::text as inspected,
      coalesce(sum("passedQuantity"), 0)::text as passed,
      coalesce(sum("reworkQuantity"), 0)::text as rework,
      coalesce(sum("rejectedQuantity"), 0)::text as rejected
    from erp_quality_inspections group by "inspectionType", status
  `.returnsRow({ type: "pg/text@1", status: "pg/text@1", count: "pg/text@1", inspected: "pg/text@1", passed: "pg/text@1", rework: "pg/text@1", rejected: "pg/text@1" }).build() as never)) as unknown as Array<Record<string, string>>;

  return {
    byType: ["INCOMING", "IN_PROCESS", "FINAL"].map((type) => {
      const own = rows.filter((row) => row.type === type);
      const approved = own.find((row) => row.status === "APPROVED");
      return {
        type,
        open: Number(own.find((row) => row.status === "OPEN")?.count ?? 0),
        approved: Number(approved?.count ?? 0),
        inspected: dec(approved?.inspected),
        passed: dec(approved?.passed),
        rework: dec(approved?.rework),
        rejected: dec(approved?.rejected),
      };
    }),
  };
}
