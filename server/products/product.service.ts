import { or } from "@prisma/orm-postgres/orm-client";

import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { recordAuditEvent } from "../auth/audit.service";
import type { ProductInput, ProductQuery } from "./product.validation";
import { toPlainDecimalString } from "../core/utils/decimal";

function toProductInput(input: ProductInput) {
  return {
    sku: input.sku,
    name: input.name,
    description: input.description || null,
    category: input.category,
    productType: input.productType,
    variant: input.variant || null,
    unit: input.unit,
    unitPrice: toPlainDecimalString(input.unitPrice),
    status: input.status,
    size: input.size || null,
    material: input.material || null,
    itemType: input.itemType || null,
    finish: input.finish || null,
    color: input.color || null,
    logoType: input.logoType || null,
    barcode: input.barcode || null,
    minimumStock: toPlainDecimalString(input.minimumStock ?? 0),
  };
}

type ProductRow = NonNullable<Awaited<ReturnType<typeof db.orm.public.Product.first>>>;

function serializeProduct(product: ProductRow) {
  return {
    ...product,
    unitPrice: Number(product.unitPrice),
    minimumStock: Number(product.minimumStock),
  };
}

async function assertBarcodeAvailable(barcode: string | undefined, id?: string) {
  if (!barcode) {
    return;
  }

  const existing = await db.orm.public.Product.where({ barcode }).first();
  if (existing && existing.id !== id) {
    throw new AppError("Another item already uses that barcode.", {
      code: "PRODUCT_BARCODE_EXISTS",
      status: 409,
    });
  }
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
  if (filters.size) {
    products = products.where({ size: filters.size });
  }
  if (filters.material) {
    products = products.where({ material: filters.material });
  }
  if (filters.finish) {
    products = products.where({ finish: filters.finish });
  }
  if (filters.logoType) {
    products = products.where({ logoType: filters.logoType });
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
    products: rows.slice(0, filters.pageSize).map(serializeProduct),
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

  return serializeProduct(product);
}

export async function createProduct(input: ProductInput, actorId: string) {
  const duplicate = await db.orm.public.Product.where({ sku: input.sku }).first();
  if (duplicate) {
    throw new AppError("A product with that SKU already exists.", {
      code: "PRODUCT_SKU_EXISTS",
      status: 409,
    });
  }
  await assertBarcodeAvailable(input.barcode);

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
  await assertBarcodeAvailable(input.barcode, id);

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

export async function restoreProduct(id: string, actorId: string) {
  const product = await getProduct(id);
  if (product.status !== "ARCHIVED") {
    return product;
  }

  await db.orm.public.Product.where({ id, status: "ARCHIVED" }).update({
    status: "INACTIVE",
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({
    actorId,
    action: "PRODUCT_RESTORED",
    entityType: "Product",
    entityId: id,
    metadata: { sku: product.sku },
  });

  return getProduct(id);
}

/*
 * Permanent deletion is allowed only for an archived item that nothing has
 * ever referenced. The product row is locked first; inserting a referencing
 * row (order line, balance, movement, reservation) needs a key-share lock on
 * it, so no new reference can appear between the check and the delete.
 * Sales order lines would otherwise be detached (ON DELETE SET NULL), so
 * they are checked explicitly.
 */
export async function deleteProductPermanently(id: string, actorId: string) {
  const product = await getProduct(id);

  if (product.status !== "ARCHIVED") {
    throw new AppError("Archive the item before deleting it permanently.", {
      code: "PRODUCT_NOT_ARCHIVED",
      status: 409,
    });
  }

  await db.transaction(async (tx) => {
    await tx.query(
      db.raw.sql`select id from erp_products where id = ${id}::uuid for update`
        .returnsRow({ id: "pg/text@1" })
        .build(),
    );

    // Sequential: one transaction runs on one connection.
    const orderLine = await tx.orm.public.SalesOrderLine.where({ productId: id }).first();
    const balance = await tx.orm.public.StockBalance.where({ productId: id }).first();
    const movement = await tx.orm.public.StockMovement.where({ productId: id }).first();
    const reservation = await tx.orm.public.StockReservation.where({ productId: id }).first();

    if (orderLine || balance || movement || reservation) {
      throw new AppError(
        "This item has order, stock or reservation history and can only stay archived.",
        { code: "PRODUCT_HAS_HISTORY", status: 409 },
      );
    }

    await tx.orm.public.Product.where({ id }).delete();
  });

  await recordAuditEvent({
    actorId,
    action: "PRODUCT_DELETED",
    entityType: "Product",
    entityId: id,
    metadata: { sku: product.sku },
  });

  return { id, deleted: true };
}
