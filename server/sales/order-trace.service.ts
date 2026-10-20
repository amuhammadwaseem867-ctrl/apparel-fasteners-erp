/*
 * Order Profile (requirements 1.2, sections 4, 18 and 21): one order and
 * everything that happened to it, so management can see at once where it
 * is, what is done and what is left, who handled it, whether QC approved
 * it, whether it is packed, dispatched, invoiced and paid.
 *
 * Read-only, assembled from the existing records; plus "send to
 * production", which opens one production order per order line.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { STAGES } from "../production/production-rules";
import { changeProductionStatus, createProductionOrder, getProductionOrder } from "../production/production.service";
import { getSalesOrder } from "./sales.service";

type Row = Record<string, unknown>;

const num = (value: unknown) => (value === null || value === undefined ? null : String(value));

/* The order statuses the requirements name, from the slowest production order. */
export function overallStatus(orderStatus: string, production: Array<{ status: string; currentStage: string | null; stages: Array<{ stageKey: string; status: string }> }>) {
  if (orderStatus === "CANCELLED") return "Cancelled";
  if (orderStatus === "DRAFT") return "New";
  const live = production.filter((order) => order.status !== "CANCELLED");
  if (live.length === 0) return "Confirmed";
  if (live.some((order) => order.status === "ON_HOLD")) return "On Hold";
  if (live.every((order) => order.status === "COMPLETED")) return "Delivered";
  if (live.every((order) => order.status === "PLANNED")) return "Confirmed";
  const sequenceOf = (order: (typeof live)[number]) => (order.status === "COMPLETED" ? 99 : STAGES.find((stage) => stage.key === order.currentStage)?.sequence ?? 1);
  const slowest = live.reduce((min, order) => (sequenceOf(order) < sequenceOf(min) ? order : min));
  const stage = sequenceOf(slowest);
  const stageStatus = (key: string) => slowest.stages.find((item) => item.stageKey === key)?.status;
  if (stage <= 6) return "In Production";
  if (stage === 7) return "QC Pending";
  if (stage === 8) return stageStatus("packing") === "PENDING" ? "QC Approved" : "Packing";
  return "Ready for Delivery";
}

export async function getOrderTrace(id: string) {
  const order = await getSalesOrder(id);
  const productionRows = await db.orm.public.ProductionOrder.where({ salesOrderId: id }).orderBy((row) => row.createdAt.asc()).all();
  const production = await Promise.all(productionRows.map((row) => getProductionOrder(row.id)));
  const productionIds = productionRows.map((row) => row.id);

  const [inspections, packingLists, shipments, invoices] = await Promise.all([
    productionIds.length ? db.orm.public.QualityInspection.where((row) => row.productionOrderId.in(productionIds)).all() : [],
    productionIds.length ? db.orm.public.PackingList.where((row) => row.productionOrderId.in(productionIds)).all() : [],
    db.orm.public.Shipment.where({ salesOrderId: id }).all(),
    db.orm.public.Invoice.where({ salesOrderId: id }).all(),
  ]);
  const shipmentIds = shipments.map((row) => row.id);
  const invoiceIds = invoices.map((row) => row.id);
  const [gatePasses, receipts, notes] = await Promise.all([
    shipmentIds.length ? db.orm.public.GatePass.where((row) => row.shipmentId.in(shipmentIds)).all() : [],
    invoiceIds.length ? db.orm.public.CustomerReceipt.where((row) => row.invoiceId.in(invoiceIds)).all() : [],
    db.orm.public.SalesOrderNote.where({ salesOrderId: id }).orderBy((row) => row.createdAt.asc()).all(),
  ]);
  const authorIds = [...new Set(notes.map((row) => row.createdBy))];
  const authors = authorIds.length ? await db.orm.public.User.where((user) => user.id.in(authorIds)).select("id", "name").all() : [];

  const status = overallStatus(order.status, production as never);
  const paid = receipts.filter((row) => row.status === "POSTED").reduce((sum, row) => sum + Number(row.amount), 0);
  const invoiced = invoices.filter((row) => row.status === "ISSUED").reduce((sum, row) => sum + Number(row.totalAmount), 0);

  return {
    order,
    status,
    production: production.map((item: Row) => ({
      id: item.id, orderNumber: item.orderNumber, salesOrderLineId: item.salesOrderLineId, status: item.status, currentStage: item.currentStage, quantity: item.quantity, unit: item.unit,
      tapeKg: num(item.tapeKg), sku: item.sku, productName: item.productName, progress: item.progress, dueDate: item.dueDate,
      stages: item.stages, materialIssues: item.materialIssues ?? [], events: item.events ?? [],
    })),
    inspections: inspections.map((row) => ({ id: row.id, inspectionNumber: row.inspectionNumber, inspectionType: row.inspectionType, status: row.status, productionOrderId: row.productionOrderId, passedQuantity: num(row.passedQuantity), rejectedQuantity: num(row.rejectedQuantity), inspectedQuantity: num(row.inspectedQuantity), createdAt: row.createdAt })),
    packingLists: packingLists.map((row) => ({ id: row.id, packingNumber: row.packingNumber, status: row.status, totalQuantity: num(row.totalQuantity), packageCount: row.packageCount, productionOrderId: row.productionOrderId, createdAt: row.createdAt })),
    shipments: shipments.map((row) => ({ id: row.id, shipmentNumber: row.shipmentNumber, status: row.status, vehicleNumber: row.vehicleNumber, dispatchedAt: row.dispatchedAt, deliveredAt: row.deliveredAt, createdAt: row.createdAt })),
    gatePasses: gatePasses.map((row) => ({ id: row.id, passNumber: row.passNumber, status: row.status, passType: row.passType, shipmentId: row.shipmentId })),
    invoices: invoices.map((row) => ({ id: row.id, invoiceNumber: row.invoiceNumber, shipmentId: row.shipmentId, status: row.status, invoiceDate: row.invoiceDate, dueDate: row.dueDate, totalAmount: num(row.totalAmount) })),
    receipts: receipts.map((row) => ({ id: row.id, receiptNumber: row.receiptNumber, status: row.status, receiptDate: row.receiptDate, amount: num(row.amount), invoiceId: row.invoiceId })),
    money: { invoiced, paid, outstanding: Math.max(0, Math.round((invoiced - paid) * 100) / 100) },
    notes: notes.map((row) => ({ id: row.id, step: row.step, note: row.note, createdAt: row.createdAt, createdByName: authors.find((user) => user.id === row.createdBy)?.name ?? null })),
  };
}

/* One released production order per order line that has none yet. */
export async function sendOrderToProduction(id: string, actorId: string) {
  const order = await getSalesOrder(id);
  if (order.status !== "APPROVED") {
    throw new AppError("Confirm (approve) the order before sending it to production.", { code: "SALES_ORDER_NOT_APPROVED", status: 409 });
  }
  const existing = await db.orm.public.ProductionOrder.where({ salesOrderId: id }).all();
  const covered = new Set(existing.filter((row) => row.status !== "CANCELLED").map((row) => row.salesOrderLineId));
  const created: string[] = [];
  for (const line of order.lines) {
    if (!line.productId || covered.has(line.id)) continue;
    const production = await createProductionOrder({
      productId: line.productId,
      quantity: Number(line.quantity),
      salesOrderId: id,
      salesOrderLineId: line.id,
      dueDate: order.deliveryDate ?? "",
      priority: "NORMAL",
      notes: [line.tapeColor && `Tape: ${line.tapeColor}`, line.slider && `Slider: ${line.slider}`].filter(Boolean).join(" · "),
    }, actorId);
    await changeProductionStatus(production.id, "release", "", actorId);
    created.push(production.id);
  }
  if (created.length === 0) {
    throw new AppError("Every line of this order is already in production.", { code: "ALREADY_IN_PRODUCTION", status: 409 });
  }
  return getOrderTrace(id);
}

export const NOTE_STEPS = ["order", "production", "qc", "packing", "dispatch", "invoice", "payment"] as const;

/* A note left on the order at a process step (D-041). Notes are kept as written. */
export async function addOrderNote(id: string, input: { step: (typeof NOTE_STEPS)[number]; note: string }, actorId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 404 });
  const order = await db.orm.public.SalesOrder.where({ id }).first();
  if (!order) throw new AppError("Sales order not found.", { code: "SALES_ORDER_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const row = await tx.orm.public.SalesOrderNote.create({ salesOrderId: id, step: input.step, note: input.note.trim(), createdBy: actorId });
    await recordAuditEvent({ actorId, action: "ORDER_NOTE_ADDED", entityType: "SalesOrder", entityId: id, metadata: { noteId: row.id, step: input.step } }, tx);
  });
  return getOrderTrace(id);
}
