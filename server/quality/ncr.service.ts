/*
 * Non-conformance reports and corrective / preventive actions (D-031).
 *
 * NCR   OPEN -> INVESTIGATING -> CLOSED; OPEN/INVESTIGATING -> CANCELLED.
 *       Closing needs a root cause and a disposition, and every CAPA on it
 *       must be VERIFIED or CANCELLED.
 * CAPA  OPEN -> IN_PROGRESS -> DONE -> VERIFIED (DONE -> IN_PROGRESS when
 *       verification fails); OPEN/IN_PROGRESS -> CANCELLED.
 * Every transition is compare-and-set and audited.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import type { CapaInput, NcrInput, NcrQuery } from "./ncr.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today = () => new Date().toISOString().slice(0, 10);
const unique = (error: unknown) => (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

function notFound(what: "NCR" | "CAPA"): never {
  throw new AppError(`${what} not found.`, { code: `${what}_NOT_FOUND`, status: 404 });
}

async function setStatus(tx: Tx, table: "erp_ncrs" | "erp_capas", id: string, from: string[], to: string) {
  const plan = table === "erp_ncrs"
    ? db.raw.sql`update erp_ncrs set status = ${to} where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id`
    : db.raw.sql`update erp_capas set status = ${to} where id = ${id}::uuid and status = any(string_to_array(${from.join(",")}, ',')) returning id::text as id`;
  return (await rows(tx, plan.returnsRow({ id: "pg/text@1" }).build())).length > 0;
}

/* ------------------------------------------------------------------ */
/* NCR                                                                 */
/* ------------------------------------------------------------------ */

export async function createNcr(input: NcrInput, actorId: string) {
  const replay = await db.orm.public.Ncr.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getNcr(replay.id);
  const checks: Array<[string | undefined, () => Promise<unknown>, string]> = [
    [input.productId, () => db.orm.public.Product.where({ id: input.productId! }).first(), "Item"],
    [input.productionOrderId, () => db.orm.public.ProductionOrder.where({ id: input.productionOrderId! }).first(), "Production order"],
    [input.inspectionId, () => db.orm.public.QualityInspection.where({ id: input.inspectionId! }).first(), "Inspection"],
    [input.supplierId, () => db.orm.public.Supplier.where({ id: input.supplierId! }).first(), "Supplier"],
    [input.customerId, () => db.orm.public.Customer.where({ id: input.customerId! }).first(), "Customer"],
  ];
  for (const [id, load, label] of checks) {
    if (id && !(await load())) throw new AppError(`${label} not found.`, { code: "NCR_LINK_NOT_FOUND", status: 400 });
  }
  try {
    const id = await db.transaction(async (tx) => {
      const ncrNumber = await allocateDocumentNumber(tx, "NCR");
      const ncr = await tx.orm.public.Ncr.create({
        ncrNumber, source: input.source, severity: input.severity, title: input.title, description: input.description,
        productId: input.productId ?? null, productionOrderId: input.productionOrderId ?? null, inspectionId: input.inspectionId ?? null,
        supplierId: input.supplierId ?? null, customerId: input.customerId ?? null,
        quantityAffected: input.quantityAffected === undefined ? null : toPlainDecimalString(input.quantityAffected),
        containment: input.containment || null, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      await recordAuditEvent({ actorId, action: "NCR_RAISED", entityType: "Ncr", entityId: ncr.id, metadata: { ncrNumber, severity: input.severity } }, tx);
      return ncr.id;
    });
    return getNcr(id);
  } catch (error) {
    if (unique(error)) {
      const original = await db.orm.public.Ncr.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getNcr(original.id);
    }
    throw error;
  }
}

export async function updateNcr(id: string, input: { containment?: string; rootCause?: string; disposition?: string }, actorId: string) {
  if (!UUID.test(id)) notFound("NCR");
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_ncrs where id = ${id}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!locked) notFound("NCR");
    if (!["OPEN", "INVESTIGATING"].includes(locked.status)) throw new AppError(`A ${locked.status.toLowerCase()} NCR cannot be edited.`, { code: "NCR_STATUS_CONFLICT", status: 409 });
    await tx.orm.public.Ncr.where({ id }).update({ containment: input.containment || null, rootCause: input.rootCause || null, disposition: input.disposition || null });
    await recordAuditEvent({ actorId, action: "NCR_UPDATED", entityType: "Ncr", entityId: id, metadata: { disposition: input.disposition || null } }, tx);
  });
  return getNcr(id);
}

export async function changeNcr(id: string, action: "investigate" | "close" | "cancel", note: string, actorId: string) {
  if (!UUID.test(id)) notFound("NCR");
  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_ncrs where id = ${id}::uuid for update`.returnsRow({ status: "pg/text@1" }).build());
    if (!locked) notFound("NCR");
    const ncr = (await tx.orm.public.Ncr.where({ id }).first())!;
    const capas = await tx.orm.public.Capa.where({ ncrId: id }).all();
    const now = new Date().toISOString();
    if (action === "investigate") {
      if (!(await setStatus(tx, "erp_ncrs", id, ["OPEN"], "INVESTIGATING"))) throw new AppError("Only open NCRs can move to investigation.", { code: "NCR_STATUS_CONFLICT", status: 409 });
    } else if (action === "close") {
      if (!["OPEN", "INVESTIGATING"].includes(locked.status)) throw new AppError(`A ${locked.status.toLowerCase()} NCR cannot be closed.`, { code: "NCR_STATUS_CONFLICT", status: 409 });
      if (!ncr.rootCause || !ncr.disposition) throw new AppError("Record the root cause and the disposition before closing.", { code: "NCR_INCOMPLETE", status: 409 });
      const open = capas.filter((capa) => !["VERIFIED", "CANCELLED"].includes(capa.status));
      if (open.length) throw new AppError(`${open.length} action(s) on this NCR are not verified yet (${open.map((capa) => capa.capaNumber).join(", ")}).`, { code: "NCR_CAPA_OPEN", status: 409 });
      await setStatus(tx, "erp_ncrs", id, ["OPEN", "INVESTIGATING"], "CLOSED");
      await tx.orm.public.Ncr.where({ id }).update({ closedBy: actorId, closedAt: now, closeNote: note || null });
    } else {
      if (!note) throw new AppError("Give a reason for cancelling.", { code: "NCR_REASON_REQUIRED", status: 400 });
      if (capas.some((capa) => capa.status !== "CANCELLED")) throw new AppError("Cancel the actions on this NCR first.", { code: "NCR_CAPA_OPEN", status: 409 });
      if (!(await setStatus(tx, "erp_ncrs", id, ["OPEN", "INVESTIGATING"], "CANCELLED"))) throw new AppError(`A ${locked.status.toLowerCase()} NCR cannot be cancelled.`, { code: "NCR_STATUS_CONFLICT", status: 409 });
      await tx.orm.public.Ncr.where({ id }).update({ closedBy: actorId, closedAt: now, closeNote: note });
    }
    await recordAuditEvent({ actorId, action: `NCR_${action.toUpperCase()}`, entityType: "Ncr", entityId: id, metadata: { note: note || null } }, tx);
  });
  return getNcr(id);
}

export async function getNcr(id: string) {
  if (!UUID.test(id)) notFound("NCR");
  const ncr = await db.orm.public.Ncr.where({ id }).first();
  if (!ncr) notFound("NCR");
  const [links] = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select coalesce((select sku || ' ' || name from erp_products where id = nullif(${ncr.productId ?? ""}, '')::uuid), '') as product,
      coalesce((select "orderNumber" from erp_production_orders where id = nullif(${ncr.productionOrderId ?? ""}, '')::uuid), '') as "productionOrder",
      coalesce((select "inspectionNumber" from erp_quality_inspections where id = nullif(${ncr.inspectionId ?? ""}, '')::uuid), '') as inspection,
      coalesce((select name from erp_suppliers where id = nullif(${ncr.supplierId ?? ""}, '')::uuid), '') as supplier,
      coalesce((select name from erp_customers where id = nullif(${ncr.customerId ?? ""}, '')::uuid), '') as customer
  `.returnsRow({ product: "pg/text@1", productionOrder: "pg/text@1", inspection: "pg/text@1", supplier: "pg/text@1", customer: "pg/text@1" }).build());
  const capas = await db.orm.public.Capa.where({ ncrId: id }).orderBy((capa) => capa.createdAt.asc()).all();
  return {
    ...ncr,
    quantityAffected: ncr.quantityAffected === null ? null : normalizeDecimalString(String(ncr.quantityAffected)),
    links: Object.fromEntries(Object.entries(links).map(([key, value]) => [key, value || null])),
    capas: capas.map((capa) => shapeCapa(capa)),
  };
}

export async function listNcrs(filters: NcrQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select n.id::text as id, n."ncrNumber", n.source, n.severity, n.title, n.status, n."createdAt"::text as "createdAt",
      coalesce(p.sku, '') as sku,
      (select count(*) from erp_capas c where c."ncrId" = n.id and c.status not in ('VERIFIED', 'CANCELLED'))::text as "openActions"
    from erp_ncrs n left join erp_products p on p.id = n."productId"
    where (${filters.status} = '' or n.status = ${filters.status} or (${filters.status} = 'ACTIVE' and n.status in ('OPEN', 'INVESTIGATING')))
      and (${filters.severity} = '' or n.severity = ${filters.severity})
      and (${filters.search} = '' or n."ncrNumber" ilike ${pattern} or n.title ilike ${pattern} or p.sku ilike ${pattern})
    order by n."createdAt" desc, n.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", ncrNumber: "pg/text@1", source: "pg/text@1", severity: "pg/text@1", title: "pg/text@1", status: "pg/text@1", createdAt: "pg/text@1", sku: "pg/text@1", openActions: "pg/text@1" }).build());
  return { ncrs: result.slice(0, filters.pageSize).map((row) => ({ ...row, sku: row.sku || null, openActions: Number(row.openActions) })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

/* ------------------------------------------------------------------ */
/* CAPA                                                                */
/* ------------------------------------------------------------------ */

function shapeCapa<T extends { status: string; dueDate: string }>(capa: T) {
  return { ...capa, overdue: ["OPEN", "IN_PROGRESS"].includes(capa.status) && capa.dueDate < today() };
}

export async function createCapa(input: CapaInput, actorId: string) {
  const replay = await db.orm.public.Capa.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getCapa(replay.id);
  try {
    const id = await db.transaction(async (tx) => {
      if (input.ncrId) {
        const [ncr] = await rows<{ status: string }>(tx, db.raw.sql`select status from erp_ncrs where id = ${input.ncrId}::uuid for share`.returnsRow({ status: "pg/text@1" }).build());
        if (!ncr) throw new AppError("NCR not found.", { code: "NCR_NOT_FOUND", status: 400 });
        if (!["OPEN", "INVESTIGATING"].includes(ncr.status)) throw new AppError(`Actions cannot be added to a ${ncr.status.toLowerCase()} NCR.`, { code: "NCR_STATUS_CONFLICT", status: 409 });
      }
      const capaNumber = await allocateDocumentNumber(tx, "CAPA");
      const capa = await tx.orm.public.Capa.create({
        capaNumber, ncrId: input.ncrId ?? null, actionType: input.actionType, title: input.title, action: input.action,
        ownerName: input.ownerName, dueDate: input.dueDate, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      await recordAuditEvent({ actorId, action: "CAPA_CREATED", entityType: "Capa", entityId: capa.id, metadata: { capaNumber, ncrId: input.ncrId ?? null } }, tx);
      return capa.id;
    });
    return getCapa(id);
  } catch (error) {
    if (unique(error)) {
      const original = await db.orm.public.Capa.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getCapa(original.id);
    }
    throw error;
  }
}

const CAPA_RULES = {
  start: [["OPEN"], "IN_PROGRESS"],
  complete: [["OPEN", "IN_PROGRESS"], "DONE"],
  verify: [["DONE"], "VERIFIED"],
  reopen: [["DONE"], "IN_PROGRESS"],
  cancel: [["OPEN", "IN_PROGRESS"], "CANCELLED"],
} as const;

export async function changeCapa(id: string, action: keyof typeof CAPA_RULES, note: string, actorId: string) {
  if (!UUID.test(id)) notFound("CAPA");
  const [from, to] = CAPA_RULES[action];
  await db.transaction(async (tx) => {
    const capa = await tx.orm.public.Capa.where({ id }).first();
    if (!capa) notFound("CAPA");
    if (!(await setStatus(tx, "erp_capas", id, [...from], to))) {
      throw new AppError(`A ${capa.status.toLowerCase().replace("_", " ")} action cannot be ${{ start: "started", complete: "completed", verify: "verified", reopen: "reopened", cancel: "cancelled" }[action]}.`, { code: "CAPA_STATUS_CONFLICT", status: 409 });
    }
    const now = new Date().toISOString();
    if (action === "complete") await tx.orm.public.Capa.where({ id }).update({ completionNote: note, completedAt: now });
    if (action === "verify") await tx.orm.public.Capa.where({ id }).update({ verifiedBy: actorId, verifiedAt: now, verificationNote: note });
    if (action === "reopen") await tx.orm.public.Capa.where({ id }).update({ verificationNote: `Not effective: ${note}`, completedAt: null });
    if (action === "cancel") await tx.orm.public.Capa.where({ id }).update({ verificationNote: `Cancelled: ${note}` });
    await recordAuditEvent({ actorId, action: `CAPA_${action.toUpperCase()}`, entityType: "Capa", entityId: id, metadata: { note: note || null } }, tx);
  });
  return getCapa(id);
}

export async function getCapa(id: string) {
  if (!UUID.test(id)) notFound("CAPA");
  const capa = await db.orm.public.Capa.where({ id }).first();
  if (!capa) notFound("CAPA");
  const ncr = capa.ncrId ? await db.orm.public.Ncr.where({ id: capa.ncrId }).first() : null;
  return { ...shapeCapa(capa), ncrNumber: ncr?.ncrNumber ?? null, ncrTitle: ncr?.title ?? null };
}

export async function listCapas(filters: NcrQuery) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select c.id::text as id, c."capaNumber", c."actionType", c.title, c."ownerName", c."dueDate", c.status, coalesce(n."ncrNumber", '') as "ncrNumber", coalesce(n.id::text, '') as "ncrId"
    from erp_capas c left join erp_ncrs n on n.id = c."ncrId"
    where (${filters.status} = '' or c.status = ${filters.status}
        or (${filters.status} = 'ACTIVE' and c.status in ('OPEN', 'IN_PROGRESS', 'DONE'))
        or (${filters.status} = 'OVERDUE' and c.status in ('OPEN', 'IN_PROGRESS') and c."dueDate" < ${today()}))
      and (${filters.search} = '' or c."capaNumber" ilike ${pattern} or c.title ilike ${pattern} or c."ownerName" ilike ${pattern} or n."ncrNumber" ilike ${pattern})
    order by c."dueDate", c."capaNumber"
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", capaNumber: "pg/text@1", actionType: "pg/text@1", title: "pg/text@1", ownerName: "pg/text@1", dueDate: "pg/text@1", status: "pg/text@1", ncrNumber: "pg/text@1", ncrId: "pg/text@1" }).build());
  return { capas: result.slice(0, filters.pageSize).map((row) => shapeCapa({ ...row, status: row.status, dueDate: row.dueDate, ncrNumber: row.ncrNumber || null, ncrId: row.ncrId || null })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}
