/*
 * D-053: a location is never required. Left blank, a form gets the item's
 * stock location (stock out) or General (stock in); inspections of a
 * production order need none; a packed list ships from where it is kept,
 * whatever the shipment's own location. Pressing Complete early never stops
 * the rest of a part delivery from being packed and delivered later.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { changeShipment, createShipment, defaultShipFrom } from "../../server/dispatch/dispatch.service.ts";
import { shipmentInputSchema } from "../../server/dispatch/dispatch.validation.ts";
import { bestStockLocation, createLocation, createWarehouse, DEFAULT_LOCATION_NAME, resolveTypedLocation } from "../../server/inventory/inventory.service.ts";
import { parseBodyWithTypedLocation } from "../../server/inventory/typed-location.ts";
import { changePackingList, createPackingList } from "../../server/packing/packing.service.ts";
import { packingListInputSchema } from "../../server/packing/packing.validation.ts";
import { changeProductionStatus, completeStage, createProductionOrder, getProductionOrder } from "../../server/production/production.service.ts";
import { STAGES } from "../../server/production/production-rules.ts";
import { productionOrderInputSchema } from "../../server/production/production.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { inspectionInputSchema } from "../../server/quality/quality.validation.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `LO${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const request = (body) => new Request("http://local/test", { method: "POST", body: JSON.stringify(body) });
const balance = async (productId, locationId) => Number((await db.orm.public.StockBalance.where({ productId, locationId }).first())?.onHand ?? 0);

test.before(async () => {
  ctx.zip = await createProduct({ sku: `ZIP-${run}`, name: `Zipper ${run}`, category: "Test", productType: "Finished Good", unit: "Pcs", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  const warehouse = await createWarehouse({ code: `LO-${run}`, name: "Store", warehouseType: "FINISHED_GOODS" }, actor);
  ctx.shelf = await createLocation({ warehouseId: warehouse.id, code: "S1", name: "Shelf 1" }, actor);
  ctx.other = await createLocation({ warehouseId: warehouse.id, code: "S2", name: "Shelf 2" }, actor);
  const customer = await createCustomer({ code: `LO-${run}`, name: "Location customer" }, actor);
  ctx.order = await createSalesOrder({
    customerId: customer.id, orderDate: "2026-10-26",
    lines: [{ kind: "catalog", productId: ctx.zip.id, quantity: 50, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);
  await changeSalesOrderStatus(ctx.order.id, "approve", actor);
  ctx.production = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 50, salesOrderId: ctx.order.id }), actor);
  await changeProductionStatus(ctx.production.id, "release", "", actor);
});

test("a blank location becomes General, or what the form's fallback picks", async () => {
  const general = await resolveTypedLocation(DEFAULT_LOCATION_NAME, actor);
  const packing = await parseBodyWithTypedLocation(request({
    idempotencyKey: randomUUID(), productionOrderId: ctx.production.id, packages: [{ packageType: "Carton", quantity: 1 }],
  }), packingListInputSchema, actor);
  assert.equal(packing.locationId, general);

  // Inspections of a production order need no location at all.
  const final = await parseBodyWithTypedLocation(request({
    idempotencyKey: randomUUID(), inspectionType: "FINAL", productionOrderId: ctx.production.id, inspectedQuantity: 1, passedQuantity: 1,
  }), inspectionInputSchema, actor, async () => "");
  assert.equal(final.locationId, undefined);

  // An invalid body is still refused before any location is made.
  await assert.rejects(parseBodyWithTypedLocation(request({ productionOrderId: "nope" }), packingListInputSchema, actor), (error) => error.code === "VALIDATION_FAILED");
});

test("a packed list ships from where it is kept, whatever the shipment's location", async () => {
  const list = await createPackingList(packingListInputSchema.parse({
    idempotencyKey: randomUUID(), productionOrderId: ctx.production.id, locationId: ctx.shelf.id, packages: [{ packageType: "Carton", quantity: 20 }],
  }), actor);
  await changePackingList(list.id, "confirm", actor);
  assert.equal(await balance(ctx.zip.id, ctx.shelf.id), 20);
  assert.equal(await bestStockLocation(ctx.zip.id, actor), ctx.shelf.id, "the item's stock is on shelf 1");
  assert.equal(await defaultShipFrom({ lines: [{ packingListId: list.id }] }, actor), ctx.shelf.id);

  // Shipment says shelf 2; the list is on shelf 1: no refusal, stock leaves shelf 1.
  const shipment = await createShipment(shipmentInputSchema.parse({
    idempotencyKey: randomUUID(), salesOrderId: ctx.order.id, locationId: ctx.other.id, lines: [{ packingListId: list.id }],
  }), actor);
  const dispatched = await changeShipment(shipment.id, "dispatch", {}, actor);
  assert.equal(dispatched.status, "DISPATCHED");
  assert.equal(await balance(ctx.zip.id, ctx.shelf.id), 0);
  assert.equal(await balance(ctx.zip.id, ctx.other.id), 0);
});

test("after every stage is completed by hand, the rest is still packed, shipped and delivered", async () => {
  for (const stage of STAGES) {
    const current = (await getProductionOrder(ctx.production.id)).stages.find((item) => item.stageKey === stage.key);
    if (current.status !== "COMPLETED") await completeStage(ctx.production.id, stage.key, actor);
  }
  assert.equal((await getProductionOrder(ctx.production.id)).status, "COMPLETED");

  const rest = await createPackingList(packingListInputSchema.parse({
    idempotencyKey: randomUUID(), productionOrderId: ctx.production.id, packages: [{ packageType: "Carton", quantity: 30 }],
    locationId: await resolveTypedLocation(DEFAULT_LOCATION_NAME, actor),
  }), actor);
  await changePackingList(rest.id, "confirm", actor);
  const shipment = await createShipment(shipmentInputSchema.parse({
    idempotencyKey: randomUUID(), salesOrderId: ctx.order.id, locationId: ctx.other.id, lines: [{ packingListId: rest.id }],
  }), actor);
  await changeShipment(shipment.id, "dispatch", {}, actor);
  const delivered = await changeShipment(shipment.id, "deliver", { receivedBy: "Store" }, actor);
  assert.equal(delivered.status, "DELIVERED");
  const order = await getProductionOrder(ctx.production.id);
  assert.equal(order.status, "COMPLETED");
  assert.equal(order.stages.find((item) => item.stageKey === "packing").processedQuantity, "50");
});
