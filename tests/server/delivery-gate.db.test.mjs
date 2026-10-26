/*
 * D-051: passing an order's outward gate pass delivers its shipment; part
 * deliveries never block, the rest shows as left (the shortfall) and a
 * later delivery settles a noted shortfall by itself.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { deliveryProgress } from "../../server/dispatch/delivery-progress.ts";
import { changeShipment, createShipment } from "../../server/dispatch/dispatch.service.ts";
import { shipmentInputSchema } from "../../server/dispatch/dispatch.validation.ts";
import { changeGatePass, createGatePass } from "../../server/gate/gate-pass.service.ts";
import { gatePassInputSchema } from "../../server/gate/gate-pass.validation.ts";
import { createLocation, createWarehouse } from "../../server/inventory/inventory.service.ts";
import { changePackingList, createPackingList } from "../../server/packing/packing.service.ts";
import { packingListInputSchema } from "../../server/packing/packing.validation.ts";
import { changeProductionStatus, createProductionOrder } from "../../server/production/production.service.ts";
import { productionOrderInputSchema } from "../../server/production/production.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { getOrderTrace } from "../../server/sales/order-trace.service.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder, listSalesOrders } from "../../server/sales/sales.service.ts";
import { createShortfall } from "../../server/sales/shortfall.service.ts";
import { shortfallInputSchema } from "../../server/sales/shortfall.validation.ts";

const run = `DG${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};
const key = () => randomUUID();

const packAndPass = async (quantity) => {
  const list = await createPackingList(packingListInputSchema.parse({
    idempotencyKey: key(), productionOrderId: ctx.production.id, locationId: ctx.fg.id,
    packages: [{ packageType: "Carton", quantity }],
  }), actor);
  return changePackingList(list.id, "confirm", actor);
};
const shipAndDispatch = async (packingListId, quantity) => {
  const shipment = await createShipment(shipmentInputSchema.parse({
    idempotencyKey: key(), salesOrderId: ctx.order.id, locationId: ctx.fg.id,
    lines: [{ packingListId, ...(quantity === undefined ? {} : { quantity }) }],
  }), actor);
  return changeShipment(shipment.id, "dispatch", {}, actor);
};
const gatePassFor = (shipment) => createGatePass(gatePassInputSchema.parse({
  idempotencyKey: key(), passType: "OUTWARD_NON_RETURNABLE", partyName: "Gate customer", purpose: "Delivery", shipmentId: shipment.id,
}), actor);
const progress = async () => (await deliveryProgress([ctx.order.id])).get(ctx.order.id);

test.before(async () => {
  ctx.zip = await createProduct({ sku: `ZIP-${run}`, name: `Zipper ${run}`, category: "Test", productType: "Finished Good", unit: "Pcs", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  const warehouse = await createWarehouse({ code: `FG-${run}`, name: "FG store", warehouseType: "FINISHED_GOODS" }, actor);
  ctx.fg = await createLocation({ warehouseId: warehouse.id, code: "F1", name: "F1" }, actor);
  ctx.customer = await createCustomer({ code: `DC-${run}`, name: "Delivery customer" }, actor);
  ctx.order = await createSalesOrder({
    customerId: ctx.customer.id, orderDate: "2026-10-20",
    lines: [{ kind: "catalog", productId: ctx.zip.id, quantity: 100, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);
  await changeSalesOrderStatus(ctx.order.id, "approve", actor);
  ctx.production = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 100, salesOrderId: ctx.order.id }), actor);
  await changeProductionStatus(ctx.production.id, "release", "", actor);
});

test("passing the outward gate pass delivers the shipment; a part delivery shows what is left", async () => {
  ctx.listA = await packAndPass(60);
  const first = await shipAndDispatch(ctx.listA.id, 40);
  assert.equal((await progress()).deliveryStatus, "Dispatched");

  const pass = await gatePassFor(first);
  await changeGatePass(pass.id, "approve", {}, actor);
  const passed = await changeGatePass(pass.id, "pass", { guardName: "Gate 1" }, actor);
  assert.equal(passed.status, "COMPLETED");

  const shipment = await db.orm.public.Shipment.where({ id: first.id }).first();
  assert.equal(shipment.status, "DELIVERED");
  assert.equal(shipment.receivedBy, "Gate customer");
  assert.match(shipment.deliveryNote, /Gate 1/);

  const now = await progress();
  assert.deepEqual([now.deliveryStatus, now.delivered, now.left], ["Part delivered", "40", "60"]);
  assert.equal((await getOrderTrace(ctx.order.id)).status, "Part delivered");
  const listed = (await listSalesOrders({ customerId: ctx.customer.id, page: 1, pageSize: 10 })).orders[0];
  assert.equal(listed.delivery.deliveryStatus, "Part delivered");

  // Marking it delivered by hand afterwards is refused as already done, nothing doubles.
  await assert.rejects(changeShipment(first.id, "deliver", { receivedBy: "x" }, actor), (error) => error.code === "SHIPMENT_STATUS_CONFLICT");
});

test("a noted shortfall is settled by later deliveries; the order ends Delivered", async () => {
  const shortfall = await createShortfall(shortfallInputSchema.parse({
    idempotencyKey: key(), salesOrderId: ctx.order.id, productId: ctx.zip.id, quantity: 60, reason: "PRODUCTION_SHORT", notes: "rest next week",
  }), actor);
  assert.equal(shortfall.status, "OPEN");

  // The rest of the first packing list goes on a second shipment, delivered at the gate.
  const second = await shipAndDispatch(ctx.listA.id);
  const pass = await gatePassFor(second);
  await changeGatePass(pass.id, "approve", {}, actor);
  await changeGatePass(pass.id, "pass", { guardName: "Gate 2" }, actor);
  let row = await db.orm.public.Shortfall.where({ id: shortfall.id }).first();
  assert.deepEqual([row.status, String(row.resolvedQuantity)], ["OPEN", "20"]);

  // The last 40 are packed later and delivered by hand.
  const listB = await packAndPass(40);
  const third = await shipAndDispatch(listB.id);
  await changeShipment(third.id, "deliver", { receivedBy: "Store" }, actor);
  row = await db.orm.public.Shortfall.where({ id: shortfall.id }).first();
  assert.deepEqual([row.status, String(row.resolvedQuantity)], ["RESOLVED", "60"]);

  const done = await progress();
  assert.deepEqual([done.deliveryStatus, done.delivered, done.left], ["Delivered", "100", "0"]);
  const trace = await getOrderTrace(ctx.order.id);
  assert.equal(trace.status, "Delivered");
  assert.deepEqual(trace.deliveryLines.map((line) => [line.ordered, line.delivered, line.left]), [["100", "100", "0"]]);
});
