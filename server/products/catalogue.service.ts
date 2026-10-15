/*
 * Product catalogue extras (D-033): categories, variant families, price
 * history and product documents.
 *
 * A product's category is the text on the product. The category register
 * gives those names a description and status; renaming a category renames
 * it on every product in the same transaction.
 * Variants are not a separate table: every size / material / finish /
 * colour / logo combination is its own SKU (Phase 3). The variants view
 * groups SKUs that share category, item type and name.
 * Price changes go through changePrice / bulkAdjustPrices, which lock the
 * product, record the previous and new price, and update it together.
 * Documents are stored in the database (5 MB each), downloaded with their
 * recorded type and checksum, and archived rather than deleted.
 */

import { createHash } from "node:crypto";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { decimalFromString, divideRoundHalfUp, normalizeDecimalString, scaledToPlainString, toPlainDecimalString } from "../core/utils/decimal";
import type { Tx } from "../inventory/inventory.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unique = (error: unknown) => (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function listCategories() {
  const registered = await db.orm.public.ProductCategory.orderBy((row) => row.name.asc()).all();
  const used = await rows<{ category: string; products: string; active: string }>(db.runtime(), db.raw.sql`
    select category, count(*)::text as products, count(*) filter (where status = 'ACTIVE')::text as active from erp_products group by category
  `.returnsRow({ category: "pg/text@1", products: "pg/text@1", active: "pg/text@1" }).build());
  const byName = new Map(used.map((row) => [row.category.toLowerCase(), row]));
  const list = registered.map((category) => {
    const usage = byName.get(category.name.toLowerCase());
    return { ...category, registered: true, products: Number(usage?.products ?? 0), activeProducts: Number(usage?.active ?? 0) };
  });
  for (const row of used) {
    if (!registered.some((category) => category.name.toLowerCase() === row.category.toLowerCase())) {
      list.push({ id: "", name: row.category, description: null, status: "ACTIVE", createdAt: "", registered: false, products: Number(row.products), activeProducts: Number(row.active) });
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(input: { name: string; description?: string }, actorId: string) {
  try {
    const category = await db.orm.public.ProductCategory.create({ name: input.name, description: input.description || null });
    await recordAuditEvent({ actorId, action: "PRODUCT_CATEGORY_CREATED", entityType: "ProductCategory", entityId: category.id, metadata: { name: input.name } });
    return category;
  } catch (error) {
    if (unique(error)) throw new AppError("That category already exists.", { code: "CATEGORY_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateCategory(id: string, input: { name: string; description?: string; status: "ACTIVE" | "INACTIVE" }, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Category not found.", { code: "CATEGORY_NOT_FOUND", status: 404 });
  try {
    const renamed = await db.transaction(async (tx) => {
      const category = await tx.orm.public.ProductCategory.where({ id }).first();
      if (!category) throw new AppError("Category not found.", { code: "CATEGORY_NOT_FOUND", status: 404 });
      await tx.orm.public.ProductCategory.where({ id }).update({ name: input.name, description: input.description || null, status: input.status });
      let count = 0;
      if (category.name !== input.name) {
        const moved = await rows<{ id: string }>(tx, db.raw.sql`
          update erp_products set category = ${input.name}, "updatedAt" = now() where lower(category) = lower(${category.name}) returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build());
        count = moved.length;
      }
      await recordAuditEvent({ actorId, action: "PRODUCT_CATEGORY_UPDATED", entityType: "ProductCategory", entityId: id, metadata: { from: category.name, to: input.name, productsRenamed: count, status: input.status } }, tx);
      return count;
    });
    return { ...(await db.orm.public.ProductCategory.where({ id }).first()), productsRenamed: renamed };
  } catch (error) {
    if (unique(error)) throw new AppError("Another category already has that name.", { code: "CATEGORY_EXISTS", status: 409 });
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Variant families                                                    */
/* ------------------------------------------------------------------ */

export async function listVariantFamilies(search: string) {
  const pattern = `%${search}%`;
  const products = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select id::text as id, sku, name, category, coalesce("itemType", '') as "itemType", coalesce(size, '') as size, coalesce(material, '') as material,
      coalesce(finish, '') as finish, coalesce(color, '') as color, coalesce("logoType", '') as "logoType", unit, "unitPrice"::text as "unitPrice", status
    from erp_products
    where status <> 'ARCHIVED' and (${search} = '' or sku ilike ${pattern} or name ilike ${pattern} or category ilike ${pattern} or "itemType" ilike ${pattern})
    order by category, "itemType" nulls first, name, size, sku
    limit 2000
  `.returnsRow({ id: "pg/text@1", sku: "pg/text@1", name: "pg/text@1", category: "pg/text@1", itemType: "pg/text@1", size: "pg/text@1", material: "pg/text@1", finish: "pg/text@1", color: "pg/text@1", logoType: "pg/text@1", unit: "pg/text@1", unitPrice: "pg/text@1", status: "pg/text@1" }).build());
  const families = new Map<string, { key: string; category: string; itemType: string; name: string; attributes: string[]; variants: typeof products }>();
  for (const product of products) {
    const key = [product.category, product.itemType, product.name].join("|").toLowerCase();
    const family = families.get(key) ?? { key, category: product.category, itemType: product.itemType, name: product.name, attributes: [], variants: [] };
    family.variants.push({ ...product, unitPrice: dec(product.unitPrice) });
    families.set(key, family);
  }
  return [...families.values()].map((family) => ({
    ...family,
    // Attributes that actually differ between the SKUs of the family.
    attributes: ["size", "material", "finish", "color", "logoType"].filter((attribute) => new Set(family.variants.map((variant) => variant[attribute])).size > 1),
  }));
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

function roundToScale(value: string, scale: number) {
  const parsed = decimalFromString(value);
  if (parsed.scale <= scale) return normalizeDecimalString(value);
  return normalizeDecimalString(scaledToPlainString({ units: divideRoundHalfUp(parsed.units, 10n ** BigInt(parsed.scale - scale)), scale }));
}

async function applyPrice(tx: Tx, productId: string, newPrice: string, effectiveDate: string, reason: string, actorId: string) {
  const [locked] = await rows<{ price: string; sku: string }>(tx, db.raw.sql`select "unitPrice"::text as price, sku from erp_products where id = ${productId}::uuid for update`.returnsRow({ price: "pg/text@1", sku: "pg/text@1" }).build());
  if (!locked) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 404 });
  const previous = dec(locked.price);
  if (previous === dec(newPrice)) return null;
  await tx.orm.public.Product.where({ id: productId }).update({ unitPrice: newPrice, updatedAt: new Date().toISOString() });
  await tx.orm.public.ProductPriceChange.create({ productId, previousPrice: previous, newPrice, effectiveDate, reason, changedBy: actorId });
  return { sku: locked.sku, previous, next: dec(newPrice) };
}

export async function changePrice(productId: string, input: { unitPrice: number; effectiveDate: string; reason: string }, actorId: string) {
  if (!UUID.test(productId)) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 404 });
  const change = await db.transaction(async (tx) => {
    const result = await applyPrice(tx, productId, toPlainDecimalString(input.unitPrice), input.effectiveDate, input.reason, actorId);
    if (result) await recordAuditEvent({ actorId, action: "PRODUCT_PRICE_CHANGED", entityType: "Product", entityId: productId, metadata: { ...result, reason: input.reason } }, tx);
    return result;
  });
  if (!change) throw new AppError("That is already the current price.", { code: "PRICE_UNCHANGED", status: 409 });
  return change;
}

/* Raises or lowers every active price in a category by a percentage, rounded half up to 6 decimals. */
export async function bulkAdjustPrices(input: { category: string; percent: number; effectiveDate: string; reason: string; apply: boolean }, actorId: string) {
  const factor = toPlainDecimalString(1 + input.percent / 100);
  const products = await db.orm.public.Product.where({ category: input.category, status: "ACTIVE" }).orderBy((row) => row.sku.asc()).all();
  const preview = products.map((product) => {
    const current = dec(product.unitPrice);
    const p = decimalFromString(current);
    const f = decimalFromString(factor);
    const raw = scaledToPlainString({ units: p.units * f.units, scale: p.scale + f.scale });
    return { productId: product.id, sku: product.sku, name: product.name, current, proposed: roundToScale(raw, 6) };
  }).filter((row) => row.current !== row.proposed);
  if (!input.apply) return { applied: false, changes: preview };
  await db.transaction(async (tx) => {
    for (const row of preview) await applyPrice(tx, row.productId, row.proposed, input.effectiveDate, input.reason, actorId);
    await recordAuditEvent({ actorId, action: "PRODUCT_PRICES_ADJUSTED", entityType: "ProductCategory", entityId: null, metadata: { category: input.category, percent: input.percent, products: preview.length, reason: input.reason } }, tx);
  });
  return { applied: true, changes: preview };
}

export async function listPriceChanges(filters: { productId?: string; page: number; pageSize: number }) {
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select c.id::text as id, c."productId"::text as "productId", p.sku, p.name, c."previousPrice"::text as "previousPrice", c."newPrice"::text as "newPrice",
      c."effectiveDate", c.reason, c."changedAt"::text as "changedAt", coalesce(u.name, '') as "changedBy"
    from erp_product_price_changes c join erp_products p on p.id = c."productId" left join erp_users u on u.id = c."changedBy"
    where (${filters.productId ?? ""} = '' or c."productId"::text = ${filters.productId ?? ""})
    order by c."changedAt" desc, c.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", productId: "pg/text@1", sku: "pg/text@1", name: "pg/text@1", previousPrice: "pg/text@1", newPrice: "pg/text@1", effectiveDate: "pg/text@1", reason: "pg/text@1", changedAt: "pg/text@1", changedBy: "pg/text@1" }).build());
  return { changes: result.slice(0, filters.pageSize).map((row) => ({ ...row, previousPrice: dec(row.previousPrice), newPrice: dec(row.newPrice) })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const DOCUMENT_TYPES = ["SPECIFICATION", "DRAWING", "TEST_REPORT", "CERTIFICATE", "IMAGE", "OTHER"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, (bytes: Uint8Array) => boolean> = {
  "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  "text/plain": (b) => !b.slice(0, 1024).includes(0),
  "text/csv": (b) => !b.slice(0, 1024).includes(0),
};

export async function uploadDocument(input: { productId: string; title: string; documentType: string; fileName: string; mimeType: string; content: Uint8Array }, actorId: string) {
  if (!UUID.test(input.productId) || !(await db.orm.public.Product.where({ id: input.productId }).first())) throw new AppError("Item not found.", { code: "PRODUCT_NOT_FOUND", status: 404 });
  if (!(DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) throw new AppError("Choose a document type.", { code: "DOCUMENT_TYPE_INVALID", status: 400 });
  if (!input.content.length) throw new AppError("The file is empty.", { code: "DOCUMENT_EMPTY", status: 400 });
  if (input.content.length > MAX_DOCUMENT_BYTES) throw new AppError("Files can be at most 5 MB.", { code: "DOCUMENT_TOO_LARGE", status: 413 });
  const check = ALLOWED[input.mimeType];
  if (!check) throw new AppError("Upload a PDF, PNG, JPEG, WebP, text or CSV file.", { code: "DOCUMENT_TYPE_NOT_ALLOWED", status: 415 });
  // The bytes must match the declared type, so a renamed file cannot slip through.
  if (!check(input.content)) throw new AppError("The file's contents do not match its type.", { code: "DOCUMENT_CONTENT_MISMATCH", status: 415 });
  const fileName = input.fileName.replace(/[^\w.\- ()]+/g, "_").slice(0, 160) || "document";
  const sha256 = createHash("sha256").update(input.content).digest("hex");
  const document = await db.orm.public.ProductDocument.create({
    productId: input.productId, title: input.title, documentType: input.documentType, fileName, mimeType: input.mimeType,
    sizeBytes: input.content.length, sha256, content: input.content, uploadedBy: actorId,
  });
  await recordAuditEvent({ actorId, action: "PRODUCT_DOCUMENT_UPLOADED", entityType: "ProductDocument", entityId: document.id, metadata: { productId: input.productId, fileName, sizeBytes: input.content.length, sha256 } });
  const { content: _content, ...meta } = document;
  void _content;
  return meta;
}

export async function listDocuments(filters: { productId?: string; status: string; search: string; page: number; pageSize: number }) {
  const pattern = `%${filters.search}%`;
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select d.id::text as id, d."productId"::text as "productId", p.sku, p.name as "productName", d.title, d."documentType", d."fileName", d."mimeType",
      d."sizeBytes"::text as "sizeBytes", d.sha256, d.status, d."uploadedAt"::text as "uploadedAt", coalesce(u.name, '') as "uploadedBy"
    from erp_product_documents d join erp_products p on p.id = d."productId" left join erp_users u on u.id = d."uploadedBy"
    where (${filters.productId ?? ""} = '' or d."productId"::text = ${filters.productId ?? ""}) and (${filters.status} = '' or d.status = ${filters.status})
      and (${filters.search} = '' or d.title ilike ${pattern} or d."fileName" ilike ${pattern} or p.sku ilike ${pattern})
    order by d."uploadedAt" desc, d.id
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", productId: "pg/text@1", sku: "pg/text@1", productName: "pg/text@1", title: "pg/text@1", documentType: "pg/text@1", fileName: "pg/text@1", mimeType: "pg/text@1", sizeBytes: "pg/text@1", sha256: "pg/text@1", status: "pg/text@1", uploadedAt: "pg/text@1", uploadedBy: "pg/text@1" }).build());
  return { documents: result.slice(0, filters.pageSize).map((row) => ({ ...row, sizeBytes: Number(row.sizeBytes) })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

export async function getDocumentContent(id: string) {
  if (!UUID.test(id)) throw new AppError("Document not found.", { code: "DOCUMENT_NOT_FOUND", status: 404 });
  const document = await db.orm.public.ProductDocument.where({ id }).first();
  if (!document) throw new AppError("Document not found.", { code: "DOCUMENT_NOT_FOUND", status: 404 });
  return document;
}

export async function archiveDocument(id: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Document not found.", { code: "DOCUMENT_NOT_FOUND", status: 404 });
  const updated = await rows<{ id: string }>(db.runtime(), db.raw.sql`
    update erp_product_documents set status = 'ARCHIVED', "archivedBy" = ${actorId}::uuid, "archivedAt" = now() where id = ${id}::uuid and status = 'ACTIVE' returning id::text as id
  `.returnsRow({ id: "pg/text@1" }).build());
  if (!updated.length) throw new AppError("This document is not active.", { code: "DOCUMENT_STATUS_CONFLICT", status: 409 });
  await recordAuditEvent({ actorId, action: "PRODUCT_DOCUMENT_ARCHIVED", entityType: "ProductDocument", entityId: id });
  return { id, status: "ARCHIVED" };
}
