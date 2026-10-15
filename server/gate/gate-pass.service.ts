/*
 * Gate passes (D-026).
 *
 * DRAFT -> APPROVED -> (gate movement) -> COMPLETED, or OUT for returnable
 * outward passes, which complete when every line has come back (partial
 * returns allowed, never more than went out). DRAFT and APPROVED passes can
 * be cancelled with a reason. Each transition is a compare-and-set; returns
 * lock the pass row. Gate passes record movement only; stock is posted by
 * inventory and dispatch documents.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { addDecimalStrings, compareDecimalStrings, normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import type { GatePassInput, GatePassQuery } from "./gate-pass.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const today = () => new Date().toISOString().slice(0, 10);

function notFound(): never {
  throw new AppError("Gate pass not found.", { code: "GATE_PASS_NOT_FOUND", status: 404 });
}

async function rows<T>(tx: Tx, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

export async function createGatePass(input: GatePassInput, actorId: string) {
  const replay = await db.orm.public.GatePass.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getGatePass(replay.id);

  let lines = input.lines.map((line) => ({ productId: line.productId ?? null, description: line.description, unit: line.unit, quantity: toPlainDecimalString(line.quantity) }));

  if (input.shipmentId) {
    const shipment = await db.orm.public.Shipment.where({ id: input.shipmentId }).first();
    if (!shipment || !["DISPATCHED", "DELIVERED"].includes(shipment.status)) {
      throw new AppError("Only dispatched shipments can be linked to a gate pass.", { code: "SHIPMENT_NOT_DISPATCHED", status: 409 });
    }
    if (!lines.length) {
      const shipmentLines = await db.orm.public.ShipmentLine.where({ shipmentId: shipment.id }).orderBy((line) => line.lineNo.asc()).all();
      const products = await db.orm.public.Product.where((product) => product.id.in(shipmentLines.map((line) => line.productId))).all();
      lines = shipmentLines.map((line) => {
        const product = products.find((item) => item.id === line.productId);
        return { productId: line.productId, description: `${product?.sku ?? ""} ${product?.name ?? ""}`.trim(), unit: product?.unit ?? "", quantity: dec(line.quantity) };
      });
    }
  }

  for (const line of lines.filter((item) => item.productId)) {
    if (!(await db.orm.public.Product.where({ id: line.productId! }).first())) {
      throw new AppError("A line refers to an unknown item.", { code: "PRODUCT_NOT_FOUND", status: 400 });
    }
  }

  try {
    const id = await db.transaction(async (tx) => {
      const passNumber = await allocateDocumentNumber(tx, "GP");
      const pass = await tx.orm.public.GatePass.create({
        passNumber,
        passType: input.passType,
        partyName: input.partyName,
        purpose: input.purpose,
        shipmentId: input.shipmentId ?? null,
        vehicleNumber: input.vehicleNumber || null,
        driverName: input.driverName || null,
        expectedReturnDate: input.passType === "OUTWARD_RETURNABLE" ? input.expectedReturnDate || null : null,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        createdBy: actorId,
      });
      for (const [index, line] of lines.entries()) {
        await tx.orm.public.GatePassLine.create({ gatePassId: pass.id, lineNo: index + 1, ...line });
      }
      await recordAuditEvent({ actorId, action: "GATE_PASS_CREATED", entityType: "GatePass", entityId: pass.id, metadata: { passNumber, passType: input.passType } }, tx);
      return pass.id;
    });
    return getGatePass(id);
  } catch (error) {
    const sqlError = findSqlQueryError(error) as { sqlState?: string; constraint?: string } | null;
    if (sqlError?.sqlState === "23505" && sqlError.constraint?.includes("idempotencyKey")) {
      const original = await db.orm.public.GatePass.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getGatePass(original.id);
    }
    throw error;
  }
}

export async function changeGatePass(
  id: string,
  action: "approve" | "pass" | "cancel",
  details: { guardName?: string; reason?: string },
  actorId: string,
) {
  if (!UUID.test(id)) notFound();
  await db.transaction(async (tx) => {
    const pass = await tx.orm.public.GatePass.where({ id }).first();
    if (!pass) notFound();
    const allowed: Record<string, string[]> = { approve: ["DRAFT"], pass: ["APPROVED"], cancel: ["DRAFT", "APPROVED"] };
    if (!allowed[action].includes(pass.status)) {
      throw new AppError(`A ${pass.status.toLowerCase()} gate pass cannot be ${action === "pass" ? "passed through the gate" : `${action}d`}.`, { code: "GATE_PASS_STATUS_CONFLICT", status: 409 });
    }
    const next = action === "approve" ? "APPROVED" : action === "cancel" ? "CANCELLED" : pass.passType === "OUTWARD_RETURNABLE" ? "OUT" : "COMPLETED";

    const updated = await rows<{ id: string }>(tx, db.raw.sql`
      update erp_gate_passes set status = ${next},
        "approvedBy" = case when ${action} = 'approve' then ${actorId}::uuid else "approvedBy" end,
        "approvedAt" = case when ${action} = 'approve' then now() else "approvedAt" end,
        "passedBy" = case when ${action} = 'pass' then ${actorId}::uuid else "passedBy" end,
        "passedAt" = case when ${action} = 'pass' then now() else "passedAt" end,
        "guardName" = case when ${action} = 'pass' then ${details.guardName ?? ""} else "guardName" end,
        "closedAt" = case when ${next} = 'COMPLETED' then now() else "closedAt" end,
        "cancelledBy" = case when ${action} = 'cancel' then ${actorId}::uuid else "cancelledBy" end,
        "cancelledAt" = case when ${action} = 'cancel' then now() else "cancelledAt" end,
        "cancelReason" = case when ${action} = 'cancel' then ${details.reason ?? ""} else "cancelReason" end
      where id = ${id}::uuid and status = ${pass.status}
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build());
    if (!updated.length) {
      throw new AppError("This gate pass was changed by someone else. Reload and try again.", { code: "GATE_PASS_STATUS_CONFLICT", status: 409 });
    }
    await recordAuditEvent({ actorId, action: `GATE_PASS_${next}`, entityType: "GatePass", entityId: id, metadata: { passNumber: pass.passNumber, from: pass.status, guardName: details.guardName || null, reason: details.reason || null } }, tx);
  });
  return getGatePass(id);
}

/* Records goods coming back on a returnable pass; completes it when all are back. */
export async function recordGatePassReturn(id: string, returns: Array<{ lineId: string; quantity: number }>, actorId: string) {
  if (!UUID.test(id)) notFound();
  await db.transaction(async (tx) => {
    const locked = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_gate_passes where id = ${id}::uuid for update`
      .returnsRow({ status: "pg/text@1" }).build());
    if (!locked.length) notFound();
    if (locked[0].status !== "OUT") {
      throw new AppError("Returns can only be recorded on a returnable pass whose goods are out.", { code: "GATE_PASS_NOT_OUT", status: 409 });
    }
    const lines = await tx.orm.public.GatePassLine.where({ gatePassId: id }).all();
    for (const item of returns) {
      const line = lines.find((row) => row.id === item.lineId);
      if (!line) throw new AppError("A returned line does not belong to this pass.", { code: "GATE_PASS_LINE_NOT_FOUND", status: 400 });
      const returned = addDecimalStrings(dec(line.returnedQuantity), toPlainDecimalString(item.quantity));
      if (compareDecimalStrings(returned, dec(line.quantity)) > 0) {
        throw new AppError(`Line ${line.lineNo}: only ${subtractDecimalStrings(dec(line.quantity), dec(line.returnedQuantity))} ${line.unit} is still out.`, { code: "RETURN_EXCEEDS_OUT", status: 409 });
      }
      await tx.orm.public.GatePassLine.where({ id: line.id }).update({ returnedQuantity: returned });
      line.returnedQuantity = returned as never;
    }
    const complete = lines.every((line) => compareDecimalStrings(dec(line.returnedQuantity), dec(line.quantity)) === 0);
    if (complete) {
      await tx.orm.public.GatePass.where({ id }).update({ status: "COMPLETED", closedAt: new Date().toISOString() });
    }
    await recordAuditEvent({ actorId, action: "GATE_PASS_RETURN", entityType: "GatePass", entityId: id, metadata: { lines: returns.length, complete } }, tx);
  });
  return getGatePass(id);
}

export async function getGatePass(id: string) {
  if (!UUID.test(id)) notFound();
  const pass = await db.orm.public.GatePass.where({ id }).first();
  if (!pass) notFound();
  const lines = await db.orm.public.GatePassLine.where({ gatePassId: id }).orderBy((line) => line.lineNo.asc()).all();
  const shipment = pass.shipmentId ? await db.orm.public.Shipment.where({ id: pass.shipmentId }).first() : null;
  const userIds = [pass.createdBy, pass.approvedBy, pass.passedBy, pass.cancelledBy].filter(Boolean) as string[];
  const users = await db.orm.public.User.where((user) => user.id.in(userIds)).select("id", "name").all();
  const name = (userId: string | null) => (userId ? users.find((user) => user.id === userId)?.name ?? null : null);
  return {
    ...pass,
    shipmentNumber: shipment?.shipmentNumber ?? null,
    overdue: pass.status === "OUT" && Boolean(pass.expectedReturnDate) && pass.expectedReturnDate! < today(),
    createdByName: name(pass.createdBy),
    approvedByName: name(pass.approvedBy),
    passedByName: name(pass.passedBy),
    cancelledByName: name(pass.cancelledBy),
    lines: lines.map((line) => ({
      ...line,
      quantity: dec(line.quantity),
      returnedQuantity: dec(line.returnedQuantity),
      outstanding: subtractDecimalStrings(dec(line.quantity), dec(line.returnedQuantity)),
    })),
  };
}

export async function listGatePasses(filters: GatePassQuery) {
  let query = db.orm.public.GatePass;
  if (filters.status === "OPEN") query = query.where((row) => row.status.in(["DRAFT", "APPROVED", "OUT"]));
  else if (filters.status) query = query.where({ status: filters.status });
  if (filters.passType) query = query.where({ passType: filters.passType });
  if (filters.overdue === "true") query = query.where({ status: "OUT" }).where((row) => row.expectedReturnDate.lt(today()));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((row) => or(row.passNumber.ilike(pattern), row.partyName.ilike(pattern), row.purpose.ilike(pattern), row.vehicleNumber.ilike(pattern)));
  }
  const result = await query.orderBy((row) => row.createdAt.desc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize + 1).all();
  const page = result.slice(0, filters.pageSize);
  const lineCounts = page.length ? await db.orm.public.GatePassLine.where((line) => line.gatePassId.in(page.map((row) => row.id))).select("gatePassId").all() : [];
  return {
    gatePasses: page.map((row) => ({
      ...row,
      lineCount: lineCounts.filter((line) => line.gatePassId === row.id).length,
      overdue: row.status === "OUT" && Boolean(row.expectedReturnDate) && row.expectedReturnDate! < today(),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}
