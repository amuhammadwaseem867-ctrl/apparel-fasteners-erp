/*
 * Packing instructions (D-034): how an item is packed, as a default and
 * optionally per customer. At most one active instruction per item and
 * customer (and one active default per item), enforced by partial unique
 * indexes. resolveInstruction picks the customer's, else the default.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import { quantityPrecisionError } from "../inventory/stock-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unique = (error: unknown) => (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";

export type InstructionInput = { productId: string; customerId?: string; packType: string; unitsPerPack: number; packsPerCarton: number; cartonType?: string; labelling?: string; instructions?: string };

async function shape(rows: Array<Record<string, unknown> & { productId: string; customerId: string | null; unitsPerPack: unknown }>) {
  const products = rows.length ? await db.orm.public.Product.where((row) => row.id.in([...new Set(rows.map((item) => item.productId))])).all() : [];
  const customerIds = [...new Set(rows.map((item) => item.customerId).filter(Boolean))] as string[];
  const customers = customerIds.length ? await db.orm.public.Customer.where((row) => row.id.in(customerIds)).all() : [];
  return rows.map((row) => {
    const product = products.find((item) => item.id === row.productId);
    const units = normalizeDecimalString(String(row.unitsPerPack));
    return {
      ...row, unitsPerPack: units,
      unitsPerCarton: normalizeDecimalString(String(Number(units) * Number(row.packsPerCarton))),
      sku: product?.sku ?? null, productName: product?.name ?? null, unit: product?.unit ?? null,
      customerName: customers.find((item) => item.id === row.customerId)?.name ?? null,
    };
  });
}

async function check(input: InstructionInput) {
  const product = await db.orm.public.Product.where({ id: input.productId }).first();
  if (!product) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 400 });
  if (input.customerId && !(await db.orm.public.Customer.where({ id: input.customerId }).first())) throw new AppError("Customer not found.", { code: "CUSTOMER_NOT_FOUND", status: 400 });
  const precision = quantityPrecisionError(input.unitsPerPack, product.unit);
  if (precision) throw new AppError(`Units per pack: ${precision}`, { code: "QUANTITY_PRECISION", status: 400 });
}

export async function listInstructions(filters: { search: string; status: string }) {
  const pattern = `%${filters.search}%`;
  const matching = filters.search ? (await db.orm.public.Product.where((row) => row.sku.ilike(pattern)).select("id").all()).map((row) => row.id) : null;
  let query = db.orm.public.PackingInstruction;
  if (filters.status) query = query.where({ status: filters.status });
  if (matching) query = query.where((row) => row.productId.in(matching.length ? matching : ["00000000-0000-0000-0000-000000000000"]));
  return shape(await query.orderBy((row) => row.updatedAt.desc()).limit(500).all() as never);
}

export async function createInstruction(input: InstructionInput, actorId: string) {
  await check(input);
  try {
    const row = await db.orm.public.PackingInstruction.create({
      productId: input.productId, customerId: input.customerId ?? null, packType: input.packType, unitsPerPack: toPlainDecimalString(input.unitsPerPack),
      packsPerCarton: input.packsPerCarton, cartonType: input.cartonType || null, labelling: input.labelling || null, instructions: input.instructions || null, createdBy: actorId,
    });
    await recordAuditEvent({ actorId, action: "PACKING_INSTRUCTION_CREATED", entityType: "PackingInstruction", entityId: row.id, metadata: { productId: input.productId, customerId: input.customerId ?? null } });
    return (await shape([row as never]))[0];
  } catch (error) {
    if (unique(error)) throw new AppError(input.customerId ? "This customer already has an active instruction for the item; edit it or deactivate it first." : "The item already has an active default instruction; edit it or deactivate it first.", { code: "PACKING_INSTRUCTION_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateInstruction(id: string, input: Omit<InstructionInput, "productId" | "customerId"> & { status: "ACTIVE" | "INACTIVE" }, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Instruction not found.", { code: "PACKING_INSTRUCTION_NOT_FOUND", status: 404 });
  const existing = await db.orm.public.PackingInstruction.where({ id }).first();
  if (!existing) throw new AppError("Instruction not found.", { code: "PACKING_INSTRUCTION_NOT_FOUND", status: 404 });
  await check({ ...input, productId: existing.productId, customerId: existing.customerId ?? undefined });
  try {
    await db.orm.public.PackingInstruction.where({ id }).update({
      packType: input.packType, unitsPerPack: toPlainDecimalString(input.unitsPerPack), packsPerCarton: input.packsPerCarton,
      cartonType: input.cartonType || null, labelling: input.labelling || null, instructions: input.instructions || null, status: input.status, updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (unique(error)) throw new AppError("Another active instruction already covers this item and customer.", { code: "PACKING_INSTRUCTION_EXISTS", status: 409 });
    throw error;
  }
  await recordAuditEvent({ actorId, action: "PACKING_INSTRUCTION_UPDATED", entityType: "PackingInstruction", entityId: id, metadata: { status: input.status } });
  return (await shape([(await db.orm.public.PackingInstruction.where({ id }).first()) as never]))[0];
}

/* The customer's active instruction for the item, else the item's active default. */
export async function resolveInstruction(productId: string, customerId?: string) {
  if (!UUID.test(productId)) return null;
  const forCustomer = customerId && UUID.test(customerId) ? await db.orm.public.PackingInstruction.where({ productId, customerId, status: "ACTIVE" }).first() : null;
  const found = forCustomer ?? (await db.orm.public.PackingInstruction.where({ productId, status: "ACTIVE" }).where((row) => row.customerId.isNull()).first());
  return found ? (await shape([found as never]))[0] : null;
}
