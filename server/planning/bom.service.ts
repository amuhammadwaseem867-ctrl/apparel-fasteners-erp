/*
 * Bill of materials authoring.
 *
 * Lifecycle: DRAFT -> APPROVED -> (active) -> OBSOLETE.
 * - Only DRAFT revisions can be edited. To change an approved BOM, "revise"
 *   copies it into a new DRAFT revision; history stays untouched.
 * - At most one active revision per item (partial unique index); activation
 *   swaps the active flag inside one transaction.
 * - Every save, approval and activation re-checks the whole active BOM
 *   graph for cycles, so an item can never end up inside itself.
 * - State changes are atomic compare-and-set updates and are audited in the
 *   same transaction.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import type { Tx } from "../inventory/inventory.service";
import { findBomCycle } from "./mrp-engine";
import type { BomInput, BomQuery, BomUpdate } from "./planning.validation";

async function rows<T>(tx: Tx | null, plan: unknown): Promise<T[]> {
  const runner = tx ?? db.runtime();
  return (await runner.query(plan as never)) as unknown as T[];
}

function notFound(): AppError {
  return new AppError("BOM not found.", { code: "BOM_NOT_FOUND", status: 404 });
}

async function loadProducts(ids: string[]) {
  const products = ids.length
    ? await db.orm.public.Product.where((product) => product.id.in(ids)).all()
    : [];
  return new Map(products.map((product) => [product.id, product]));
}

async function validateItems(productId: string, componentIds: string[]) {
  const products = await loadProducts([productId, ...componentIds]);
  const parent = products.get(productId);

  if (!parent) {
    throw new AppError("The BOM item does not exist.", { code: "PRODUCT_NOT_FOUND", status: 400 });
  }

  for (const id of componentIds) {
    const component = products.get(id);
    if (!component) {
      throw new AppError("A component does not exist.", { code: "PRODUCT_NOT_FOUND", status: 400, details: { componentId: id } });
    }
    if (component.status === "ARCHIVED") {
      throw new AppError(`${component.sku} is archived and cannot be used as a component.`, {
        code: "PRODUCT_ARCHIVED",
        status: 409,
      });
    }
  }

  return products;
}

/*
 * Cycle check: the active BOM graph, with `productId`'s entry replaced by
 * the candidate component list.
 */
async function assertNoCycle(productId: string, componentIds: string[]) {
  const active = await db.orm.public.Bom.where({ isActive: true }).select("id", "productId").all();
  const lines = active.length
    ? await db.orm.public.BomLine.where((line) => line.bomId.in(active.map((bom) => bom.id))).select("bomId", "componentId").all()
    : [];
  const graph = new Map<string, string[]>();

  for (const bom of active) {
    graph.set(bom.productId, lines.filter((line) => line.bomId === bom.id).map((line) => line.componentId));
  }
  graph.set(productId, componentIds);

  const cycle = findBomCycle(graph);

  if (cycle) {
    const products = await loadProducts([...new Set(cycle)]);
    throw new AppError(
      `This BOM would create a cycle: ${cycle.map((id) => products.get(id)?.sku ?? id).join(" → ")}.`,
      { code: "BOM_CYCLE", status: 409, details: { path: cycle } },
    );
  }
}

async function writeLines(tx: Tx, bomId: string, lines: BomInput["lines"]) {
  let lineNo = 0;
  for (const line of lines) {
    await tx.orm.public.BomLine.create({
      bomId,
      lineNo: ++lineNo,
      componentId: line.componentId,
      quantity: toPlainDecimalString(line.quantity),
      scrapPercent: toPlainDecimalString(line.scrapPercent ?? 0),
      notes: line.notes || null,
    });
  }
}

export async function getBom(id: string) {
  const bom = await db.orm.public.Bom.where({ id }).first();
  if (!bom) throw notFound();

  const lines = await db.orm.public.BomLine.where({ bomId: id }).orderBy((line) => line.lineNo.asc()).all();
  const products = await loadProducts([bom.productId, ...lines.map((line) => line.componentId)]);
  const product = products.get(bom.productId);

  return {
    ...bom,
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    unit: product?.unit ?? null,
    lines: lines.map((line) => {
      const component = products.get(line.componentId);
      return {
        id: line.id,
        lineNo: line.lineNo,
        componentId: line.componentId,
        sku: component?.sku ?? null,
        productName: component?.name ?? null,
        unit: component?.unit ?? null,
        quantity: normalizeDecimalString(String(line.quantity)),
        scrapPercent: normalizeDecimalString(String(line.scrapPercent)),
        notes: line.notes,
      };
    }),
  };
}

export async function listBoms(filters: BomQuery) {
  let query = db.orm.public.Bom;

  if (filters.productId) query = query.where({ productId: filters.productId });
  if (filters.status) query = query.where({ status: filters.status });

  const result = await query
    .orderBy((bom) => bom.updatedAt.desc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const page = result.slice(0, filters.pageSize);
  const products = await loadProducts([...new Set(page.map((bom) => bom.productId))]);
  const lines = page.length
    ? await db.orm.public.BomLine.where((line) => line.bomId.in(page.map((bom) => bom.id))).select("bomId").all()
    : [];

  return {
    boms: page.map((bom) => ({
      ...bom,
      sku: products.get(bom.productId)?.sku ?? null,
      productName: products.get(bom.productId)?.name ?? null,
      lineCount: lines.filter((line) => line.bomId === bom.id).length,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

/* Creates a new DRAFT revision; revision numbers are assigned under a lock
 * on the parent item so concurrent creates cannot collide. */
async function createRevision(productId: string, input: BomUpdate, actorId: string, copiedFrom?: string) {
  await validateItems(productId, input.lines.map((line) => line.componentId));
  await assertNoCycle(productId, input.lines.map((line) => line.componentId));

  const id = await db.transaction(async (tx) => {
    await rows(tx, db.raw.sql`select id::text as id from erp_products where id = ${productId}::uuid for update`
      .returnsRow({ id: "pg/text@1" }).build());
    const [last] = await rows<{ revision: string }>(tx, db.raw.sql`
      select coalesce(max(revision), 0)::text as revision from erp_boms where "productId" = ${productId}::uuid
    `.returnsRow({ revision: "pg/text@1" }).build());

    const bom = await tx.orm.public.Bom.create({
      productId,
      revision: Number(last.revision) + 1,
      effectiveFrom: input.effectiveFrom || null,
      notes: input.notes || null,
      createdBy: actorId,
    });
    await writeLines(tx, bom.id, input.lines);
    await recordAuditEvent({
      actorId,
      action: copiedFrom ? "BOM_REVISED" : "BOM_CREATED",
      entityType: "Bom",
      entityId: bom.id,
      metadata: { productId, revision: bom.revision, copiedFrom: copiedFrom ?? null },
    }, tx);
    return bom.id;
  });

  return getBom(id);
}

export function createBom(input: BomInput, actorId: string) {
  return createRevision(input.productId, input, actorId);
}

export async function updateBom(id: string, input: BomUpdate, actorId: string) {
  const current = await getBom(id);
  await validateItems(current.productId, input.lines.map((line) => line.componentId));
  if (input.lines.some((line) => line.componentId === current.productId)) {
    throw new AppError("An item cannot be a component of itself.", { code: "BOM_CYCLE", status: 409 });
  }
  await assertNoCycle(current.productId, input.lines.map((line) => line.componentId));

  await db.transaction(async (tx) => {
    const [locked] = await rows<{ status: string }>(tx, db.raw.sql`
      select status from erp_boms where id = ${id}::uuid for update
    `.returnsRow({ status: "pg/text@1" }).build());

    if (locked?.status !== "DRAFT") {
      throw new AppError("Only draft BOMs can be edited. Create a new revision instead.", {
        code: "BOM_NOT_EDITABLE",
        status: 409,
      });
    }

    await tx.orm.public.Bom.where({ id }).update({
      effectiveFrom: input.effectiveFrom || null,
      notes: input.notes || null,
      updatedAt: new Date().toISOString(),
    });
    await tx.orm.public.BomLine.where({ bomId: id }).deleteAll();
    await writeLines(tx, id, input.lines);
    await recordAuditEvent({ actorId, action: "BOM_UPDATED", entityType: "Bom", entityId: id, metadata: { revision: current.revision } }, tx);
  });

  return getBom(id);
}

export async function changeBomState(id: string, action: string, actorId: string) {
  const current = await getBom(id);

  if (action === "revise") {
    return createRevision(current.productId, {
      effectiveFrom: current.effectiveFrom ?? "",
      notes: current.notes ?? "",
      lines: current.lines.map((line) => ({
        componentId: line.componentId,
        quantity: Number(line.quantity),
        scrapPercent: Number(line.scrapPercent),
        notes: line.notes ?? "",
      })),
    }, actorId, id);
  }

  if (action === "approve" || action === "activate") {
    await assertNoCycle(current.productId, current.lines.map((line) => line.componentId));
  }

  const AUDIT_ACTIONS: Record<string, string> = {
    approve: "BOM_APPROVED",
    activate: "BOM_ACTIVATED",
    obsolete: "BOM_MADE_OBSOLETE",
  };

  await db.transaction(async (tx) => {
    let changed: Array<{ id: string }> = [];
    const returning = { id: "pg/text@1" } as const;

    if (action === "approve") {
      changed = await rows(tx, db.raw.sql`
        update erp_boms set status = 'APPROVED', "approvedBy" = ${actorId}::uuid, "approvedAt" = now(), "updatedAt" = now()
        where id = ${id}::uuid and status = 'DRAFT'
        returning id::text as id
      `.returnsRow(returning).build());
    } else if (action === "activate") {
      // Serialise activations for this item: a concurrent activation waits
      // here and then sees the committed state, instead of failing on the
      // one-active-revision index.
      await rows(tx, db.raw.sql`select id::text as id from erp_products where id = ${current.productId}::uuid for update`
        .returnsRow(returning).build());
      // Deactivate the current active revision, then activate this one.
      await rows(tx, db.raw.sql`
        update erp_boms set "isActive" = false, "updatedAt" = now()
        where "productId" = ${current.productId}::uuid and "isActive" and id <> ${id}::uuid
        returning id::text as id
      `.returnsRow(returning).build());
      changed = await rows(tx, db.raw.sql`
        update erp_boms set "isActive" = true, "updatedAt" = now()
        where id = ${id}::uuid and status = 'APPROVED'
        returning id::text as id
      `.returnsRow(returning).build());
    } else if (action === "obsolete") {
      changed = await rows(tx, db.raw.sql`
        update erp_boms set status = 'OBSOLETE', "isActive" = false, "updatedAt" = now()
        where id = ${id}::uuid and status = 'APPROVED'
        returning id::text as id
      `.returnsRow(returning).build());
    }

    if (!changed.length) {
      const verbs: Record<string, string> = {
        approve: "Only a draft BOM can be approved.",
        activate: "Only an approved BOM can be activated.",
        obsolete: "Only an approved BOM can be made obsolete.",
      };
      throw new AppError(verbs[action] ?? "Unsupported BOM action.", {
        code: "BOM_STATUS_CONFLICT",
        status: 409,
      });
    }

    await recordAuditEvent({
      actorId,
      action: AUDIT_ACTIONS[action],
      entityType: "Bom",
      entityId: id,
      metadata: { productId: current.productId, revision: current.revision },
    }, tx);
  });

  return getBom(id);
}
