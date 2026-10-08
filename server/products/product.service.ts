import { or } from "@prisma/orm-postgres/orm-client";

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { recordAuditEvent } from "../auth/audit.service";
import type { ProductInput, ProductQuery } from "./product.validation";

function toProductInput(input: ProductInput) {
  return {
    sku: input.sku,
    name: input.name,
    description: input.description || null,
    category: input.category,
    productType: input.productType,
    variant: input.variant || null,
    unit: input.unit,
    unitPrice: input.unitPrice.toFixed(2),
    status: input.status,
  };
}

export async function listProducts(filters: ProductQuery) {
  let products = db.orm.public.Product;

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    products = products.where((product) => or(
      product.sku.ilike(pattern),
      product.name.ilike(pattern),
      product.category.ilike(pattern),
      product.variant.ilike(pattern),
    ));
  }
  if (filters.category) {
    products = products.where((product) => product.category.ilike(`%${filters.category}%`));
  }
  if (filters.productType) {
    products = products.where({ productType: filters.productType });
  }
  if (filters.variant) {
    products = products.where((product) => product.variant.ilike(`%${filters.variant}%`));
  }
  if (filters.status) {
    products = products.where({ status: filters.status });
  } else {
    products = products.where((product) => product.status.neq("ARCHIVED"));
  }

  const rows = await products
    .orderBy((product) => product.name.asc())
    .offset((filters.page - 1) * filters.pageSize)
    .limit(filters.pageSize + 1)
    .all();
  const hasMore = rows.length > filters.pageSize;

  return {
    products: rows.slice(0, filters.pageSize).map((product) => ({
      ...product,
      unitPrice: Number(product.unitPrice),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore,
  };
}

export async function getProduct(id: string) {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) {
    throw new AppError("Product not found.", {
      code: "PRODUCT_NOT_FOUND",
      status: 404,
    });
  }

  return { ...product, unitPrice: Number(product.unitPrice) };
}

export async function createProduct(input: ProductInput, actorId: string) {
  const duplicate = await db.orm.public.Product.where({ sku: input.sku }).first();
  if (duplicate) {
    throw new AppError("A product with that SKU already exists.", {
      code: "PRODUCT_SKU_EXISTS",
      status: 409,
    });
  }

  const product = await db.orm.public.Product.create(toProductInput(input));
  await recordAuditEvent({
    actorId,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    metadata: { sku: product.sku },
  });

  return getProduct(product.id);
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  actorId: string,
) {
  const current = await getProduct(id);
  if (current.status === "ARCHIVED") {
    throw new AppError("Archived products cannot be edited.", {
      code: "PRODUCT_ARCHIVED",
      status: 409,
    });
  }
  const duplicate = await db.orm.public.Product
    .where({ sku: input.sku })
    .first();
  if (duplicate && duplicate.id !== id) {
    throw new AppError("A product with that SKU already exists.", {
      code: "PRODUCT_SKU_EXISTS",
      status: 409,
    });
  }

  await db.orm.public.Product.where({ id }).update({
    ...toProductInput(input),
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({
    actorId,
    action: "PRODUCT_UPDATED",
    entityType: "Product",
    entityId: id,
    metadata: { sku: current.sku, newSku: input.sku },
  });

  return getProduct(id);
}

export async function archiveProduct(id: string, actorId: string) {
  const product = await getProduct(id);
  if (product.status === "ARCHIVED") {
    return product;
  }

  await db.orm.public.Product.where({ id }).update({
    status: "ARCHIVED",
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({
    actorId,
    action: "PRODUCT_ARCHIVED",
    entityType: "Product",
    entityId: id,
    metadata: { sku: product.sku },
  });

  return getProduct(id);
}
