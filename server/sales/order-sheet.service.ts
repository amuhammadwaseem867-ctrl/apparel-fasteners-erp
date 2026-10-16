/*
 * The order sheet (requirements 1.2, section 6): an order is entered as
 * Customer, Customer PO Number, Order No, then per line Product, Variant,
 * Finish, Type (Plain Teeth / Y-Cut), Tape Color, Slider, Size, Unit and
 * Quantity. Prices are optional at this point (production never sees them).
 *
 * Production, packing, dispatch and invoicing all follow an item, so each
 * line is tied to the finished-good item for exactly that specification:
 * found by its SKU, or created once. A different finish, type, tape colour,
 * slider or size is a different item, never merged (section 22).
 */

import { suggestSku } from "../../lib/inventory/sku.js";
import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { toPlainDecimalString } from "../core/utils/decimal";
import { createSalesOrder, updateSalesOrder } from "./sales.service";
import type { OrderSheetInput } from "./sales.validation";

type SheetLine = OrderSheetInput["lines"][number];

const clean = (value?: string | null) => (value ?? "").trim();

export function lineSku(line: SheetLine) {
  const base = suggestSku({
    category: "Zipper",
    size: clean(line.size),
    itemType: clean(line.teethType),
    finish: clean(line.finish),
    color: clean(line.tapeColor),
    variant: clean(line.variant),
    material: "",
    logoType: "",
  });
  const product = clean(line.product).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10);
  const slider = clean(line.slider).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8);
  return [base, product, slider].filter(Boolean).join("-").slice(0, 80);
}

export function lineItemName(line: SheetLine) {
  const spec = [clean(line.size), clean(line.teethType), clean(line.finish), clean(line.tapeColor), clean(line.slider) && `Slider ${clean(line.slider)}`]
    .filter(Boolean).join(", ");
  return `${clean(line.product)}${clean(line.variant) ? ` ${clean(line.variant)}` : ""}${spec ? ` (${spec})` : ""}`.slice(0, 180);
}

/* Finds or creates the finished-good item for each line's specification. */
async function itemsForLines(lines: SheetLine[], actorId: string) {
  const ids: string[] = [];
  for (const line of lines) {
    const sku = lineSku(line);
    let product = await db.orm.public.Product.where({ sku }).first();
    if (product?.status === "ARCHIVED") {
      throw new AppError(`Item ${sku} is archived. Restore it in the item master, or change the line.`, { code: "PRODUCT_ARCHIVED", status: 409 });
    }
    if (!product) {
      try {
        product = await db.orm.public.Product.create({
          sku,
          name: lineItemName(line),
          category: "Finished Goods",
          productType: "Finished Good",
          variant: clean(line.variant) || null,
          unit: line.unit,
          unitPrice: toPlainDecimalString(line.unitPrice ?? 0),
          status: "ACTIVE",
          size: clean(line.size) || null,
          itemType: clean(line.teethType) || null,
          finish: clean(line.finish) || null,
          color: clean(line.tapeColor) || null,
          description: clean(line.slider) ? `Slider: ${clean(line.slider)}` : null,
          minimumStock: "0",
        });
        await recordAuditEvent({ actorId, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id, metadata: { sku, source: "order-sheet" } });
      } catch (error) {
        // Two orders with a new specification at once: the other one created it.
        product = await db.orm.public.Product.where({ sku }).first();
        if (!product) throw error;
      }
    }
    ids.push(product.id);
  }
  return ids;
}

async function toSalesOrderInput(input: OrderSheetInput, actorId: string) {
  const productIds = await itemsForLines(input.lines, actorId);
  return {
    customerId: input.customerId,
    customerPo: input.customerPo,
    orderNumber: input.orderNumber,
    orderDate: input.orderDate,
    deliveryDate: input.deliveryDate,
    notes: input.notes,
    lines: input.lines.map((line, index) => ({
      kind: "catalog" as const,
      productId: productIds[index],
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? 0,
      discountPercent: 0,
      taxPercent: line.taxPercent ?? 18,
      notes: "",
      tapeColor: line.tapeColor,
      finish: line.finish,
      size: line.size,
      teethType: line.teethType,
      slider: line.slider,
      description: line.product,
    })),
  };
}

export async function createOrderFromSheet(input: OrderSheetInput, actorId: string) {
  return createSalesOrder(await toSalesOrderInput(input, actorId), actorId);
}

export async function updateOrderFromSheet(id: string, input: OrderSheetInput, actorId: string) {
  return updateSalesOrder(id, await toSalesOrderInput(input, actorId), actorId);
}
