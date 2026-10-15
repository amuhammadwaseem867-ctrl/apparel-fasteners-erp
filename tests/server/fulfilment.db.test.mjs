import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { changeShipment, createShipment, getSalesOrderFulfilment } from "../../server/dispatch/dispatch.service.ts";
import { shipmentInputSchema } from "../../server/dispatch/dispatch.validation.ts";
import { createLocation, createReservation, createWarehouse, postStockDocument } from "../../server/inventory/inventory.service.ts";
import { reservationInputSchema, stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { changePackingList, createPackingList } from "../../server/packing/packing.service.ts";
import { packingListInputSchema } from "../../server/packing/packing.validation.ts";
import {
  changeProductionStatus,
  completeStage,
  createProductionOrder,
  getProductionOrder,
  recordStageRun,
} from "../../server/production/production.service.ts";
import { productionOrderInputSchema, stageRunInputSchema } from "../../server/production/production.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { createInspection, decideInspection } from "../../server/quality/quality.service.ts";
import { inspectionInputSchema } from "../../server/quality/quality.validation.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `F${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const ctx = {};

const EARLY_STAGES = ["tape-dyeing", "tape-press", "teeth-making", "plating", "lacquer-wax", "assembling"];

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

const key = () => randomUUID();
const stage = (order, stageKey) => order.stages.find((item) => item.stageKey === stageKey);
const balance = async (productId, locationId) => db.orm.public.StockBalance.where({ productId, locationId }).first();
const inspect = (input) => createInspection(inspectionInputSchema.parse({ idempotencyKey: key(), ...input }), actor);
const pack = (quantities) => createPackingList(packingListInputSchema.parse({
  idempotencyKey: key(),
  productionOrderId: ctx.order.id,
  locationId: ctx.fg.id,
  packages: quantities.map((quantity) => ({ packageType: "Carton", quantity, netWeight: 5, grossWeight: 5.4 })),
}), actor);
const ship = (lines) => createShipment(shipmentInputSchema.parse({
  idempotencyKey: key(),
  salesOrderId: ctx.salesOrder.id,
  locationId: ctx.fg.id,
  vehicleNumber: "LEA-1234",
  lines,
}), actor);

test.before(async () => {
  ctx.zip = await createProduct({ sku: `ZIP-${run}`, name: `Zipper ${run}`, category: "Test", productType: "Finished Good", unit: "Pcs", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  ctx.tape = await createProduct({ sku: `TAPE-${run}`, name: `Tape ${run}`, category: "Test", productType: "Raw Material", unit: "Meters", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  const fgWarehouse = await createWarehouse({ code: `FG-${run}`, name: "FG store", warehouseType: "FINISHED_GOODS" }, actor);
  ctx.fg = await createLocation({ warehouseId: fgWarehouse.id, code: "F1", name: "F1" }, actor);
  const rmWarehouse = await createWarehouse({ code: `RM-${run}`, name: "RM store", warehouseType: "RAW_MATERIAL" }, actor);
  ctx.rm = await createLocation({ warehouseId: rmWarehouse.id, code: "R1", name: "R1" }, actor);

  const customer = await createCustomer({ code: `FC-${run}`, name: "Fulfilment customer" }, actor);
  ctx.salesOrder = await createSalesOrder({
    customerId: customer.id,
    orderDate: "2026-10-15",
    deliveryDate: "2026-12-01",
    lines: [{ kind: "catalog", productId: ctx.zip.id, quantity: 100, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);
  await changeSalesOrderStatus(ctx.salesOrder.id, "approve", actor);

  ctx.order = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 100, salesOrderId: ctx.salesOrder.id }), actor);
  await changeProductionStatus(ctx.order.id, "release", "", actor);
  for (const stageKey of EARLY_STAGES) {
    await recordStageRun(ctx.order.id, stageKey, stageRunInputSchema.parse({ idempotencyKey: key(), inputQuantity: 100, acceptedQuantity: 100 }), actor);
    await completeStage(ctx.order.id, stageKey, actor);
  }
});

test("quality check, packing and sales-order delivery cannot be recorded by hand", async () => {
  for (const stageKey of ["quality-check", "packing", "delivered"]) {
    await expectCode(
      recordStageRun(ctx.order.id, stageKey, stageRunInputSchema.parse({ idempotencyKey: key(), inputQuantity: 1, acceptedQuantity: 1 }), actor),
      "STAGE_MANAGED_ELSEWHERE",
    );
  }
});

test("final inspections drive the quality-check stage, once per approval", async () => {
  await expectCode(inspect({ inspectionType: "FINAL", productionOrderId: ctx.order.id, inspectedQuantity: 101, passedQuantity: 101 }), "INSPECTION_EXCEEDS_AVAILABLE");
  assert.equal(inspectionInputSchema.safeParse({ idempotencyKey: key(), inspectionType: "FINAL", productionOrderId: ctx.order.id, inspectedQuantity: 10, passedQuantity: 9 }).success, false, "parts must add up");

  const first = await inspect({
    inspectionType: "FINAL", productionOrderId: ctx.order.id,
    inspectedQuantity: 100, passedQuantity: 90, reworkQuantity: 6, rejectedQuantity: 4,
    defects: [{ description: "Slider stiff", count: 6 }, { description: "Teeth misaligned", count: 4 }],
  });
  assert.equal(first.status, "OPEN");
  assert.equal(stage(await getProductionOrder(ctx.order.id), "quality-check").processedQuantity, "0", "recording does not apply results");

  const outcomes = await Promise.allSettled([1, 2, 3].map(() => decideInspection(first.id, "approve", "", actor)));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  for (const outcome of outcomes.filter((item) => item.status === "rejected")) assert.equal(outcome.reason.code, "INSPECTION_STATUS_CONFLICT");

  let qc = stage(await getProductionOrder(ctx.order.id), "quality-check");
  assert.deepEqual([qc.acceptedQuantity, qc.reworkQuantity, qc.rejectedQuantity, qc.available], ["90", "6", "4", "6"]);

  const reinspection = await inspect({ inspectionType: "FINAL", productionOrderId: ctx.order.id, inspectedQuantity: 6, passedQuantity: 6 });
  await decideInspection(reinspection.id, "approve", "Rework passed", actor);
  qc = stage(await completeStage(ctx.order.id, "quality-check", actor), "quality-check");
  assert.equal(qc.acceptedQuantity, "96");
  assert.equal(qc.status, "COMPLETED");
});

test("packing cannot exceed QC-passed output; confirming receives finished goods once", async () => {
  await expectCode(pack([50, 47]), "PACKING_EXCEEDS_AVAILABLE");

  ctx.listA = await pack([30, 30]);
  assert.equal(ctx.listA.totalQuantity, "60");
  assert.equal(ctx.listA.packageCount, 2);
  const confirmed = await changePackingList(ctx.listA.id, "confirm", actor);
  assert.equal(confirmed.status, "CONFIRMED");
  assert.deepEqual(confirmed.stockDocuments.map((document) => document.documentType), ["FG_RECEIPT"]);
  assert.equal(String((await balance(ctx.zip.id, ctx.fg.id)).onHand), "60");
  await expectCode(changePackingList(ctx.listA.id, "confirm", actor), "PACKING_STATUS_CONFLICT");

  // Two drafts for the remaining 36: only one can be confirmed.
  const b = await pack([36]);
  const c = await pack([36]);
  const outcomes = await Promise.allSettled([changePackingList(b.id, "confirm", actor), changePackingList(c.id, "confirm", actor)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "STAGE_RUN_INVALID");
  ctx.listB = outcomes[0].status === "fulfilled" ? b : c;
  await changePackingList(ctx.listB.id === b.id ? c.id : b.id, "cancel", actor);

  assert.equal(String((await balance(ctx.zip.id, ctx.fg.id)).onHand), "96", "the losing confirmation posted no stock");
  const order = await completeStage(ctx.order.id, "packing", actor);
  assert.equal(stage(order, "packing").acceptedQuantity, "96");
});

test("dispatch posts stock out once, consumes the order's reservation, and cannot over-ship", async () => {
  await expectCode(ship([{ packingListId: ctx.listA.id }, { productId: ctx.zip.id, quantity: 41 }]), "SHIPMENT_EXCEEDS_ORDER");

  const first = await ship([{ packingListId: ctx.listA.id }]);
  assert.equal(first.status, "DRAFT");
  ctx.first = await changeShipment(first.id, "dispatch", {}, actor);
  assert.equal(ctx.first.status, "DISPATCHED");
  assert.deepEqual(ctx.first.stockDocuments.map((document) => document.documentType), ["FG_DISPATCH"]);
  assert.equal(String((await balance(ctx.zip.id, ctx.fg.id)).onHand), "36");
  await expectCode(ship([{ packingListId: ctx.listA.id }]), "PACKING_LIST_NOT_SHIPPABLE");
  await expectCode(changeShipment(first.id, "cancel", {}, actor), "SHIPMENT_STATUS_CONFLICT");

  // Reserve 10 for this order; two drafts carry the same packing list.
  const reservation = await createReservation(reservationInputSchema.parse({
    idempotencyKey: key(), productId: ctx.zip.id, locationId: ctx.fg.id, quantity: 10, salesOrderId: ctx.salesOrder.id,
  }), actor);
  const x = await ship([{ packingListId: ctx.listB.id }]);
  const y = await ship([{ packingListId: ctx.listB.id }]);
  const outcomes = await Promise.allSettled([changeShipment(x.id, "dispatch", {}, actor), changeShipment(y.id, "dispatch", {}, actor)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  ctx.second = outcomes[0].status === "fulfilled" ? outcomes[0].value : outcomes[1].value;

  const after = await balance(ctx.zip.id, ctx.fg.id);
  assert.deepEqual([String(after.onHand), String(after.reserved)], ["0", "0"]);
  const consumed = await db.orm.public.StockReservation.where({ id: (reservation.reservation ?? reservation).id }).first();
  assert.equal(consumed.status, "CONSUMED");
  assert.equal(String(consumed.consumedQuantity), "10");

  await expectCode(changeSalesOrderStatus(ctx.salesOrder.id, "cancel", actor), "SALES_ORDER_SHIPPED");
});

test("delivery records the Delivered stage; the order completes; fulfilment adds up", async () => {
  await expectCode(changeShipment(ctx.first.id, "dispatch", {}, actor), "SHIPMENT_STATUS_CONFLICT");
  const delivered = await changeShipment(ctx.first.id, "deliver", { receivedBy: "Store keeper", deliveryNote: "2 cartons" }, actor);
  assert.equal(delivered.status, "DELIVERED");
  assert.equal(delivered.receivedBy, "Store keeper");
  await changeShipment(ctx.second.id, "deliver", { receivedBy: "Store keeper" }, actor);

  const order = await completeStage(ctx.order.id, "delivered", actor);
  assert.equal(order.status, "COMPLETED");
  assert.equal(order.deliveredQuantity, "96");

  const fulfilment = await getSalesOrderFulfilment(ctx.salesOrder.id);
  assert.deepEqual(
    fulfilment.items.map((item) => [item.ordered, item.shipped, item.delivered, item.remaining]),
    [["100", "96", "96", "4"]],
  );
});

test("incoming inspection releases passed stock, scraps rejects and keeps rework on hold", async () => {
  await postStockDocument(stockDocumentInputSchema.parse({ documentType: "GOODS_RECEIPT", idempotencyKey: key(), lines: [{ productId: ctx.tape.id, locationId: ctx.rm.id, quantity: 50 }] }), actor);
  await postStockDocument(stockDocumentInputSchema.parse({ documentType: "QC_HOLD", idempotencyKey: key(), reason: "Incoming QC", lines: [{ productId: ctx.tape.id, locationId: ctx.rm.id, quantity: 50 }] }), actor);

  await expectCode(inspect({ inspectionType: "INCOMING", productId: ctx.tape.id, locationId: ctx.rm.id, inspectedQuantity: 51, passedQuantity: 51 }), "INSPECTION_EXCEEDS_HOLD");
  const inspection = await inspect({
    inspectionType: "INCOMING", productId: ctx.tape.id, locationId: ctx.rm.id,
    inspectedQuantity: 50, passedQuantity: 40, reworkQuantity: 5, rejectedQuantity: 5,
  });
  const approved = await decideInspection(inspection.id, "approve", "Shade variation", actor);
  assert.deepEqual(approved.stockDocuments.map((document) => document.documentType).sort(), ["QC_REJECT", "QC_RELEASE"]);

  const after = await balance(ctx.tape.id, ctx.rm.id);
  assert.deepEqual([String(after.onHand), String(after.qualityHold)], ["45", "5"]);
  await expectCode(decideInspection(inspection.id, "cancel", "", actor), "INSPECTION_STATUS_CONFLICT");
});

test("module-owned stock sources cannot be forged through the stock API", async () => {
  await expectCode(postStockDocument(stockDocumentInputSchema.parse({
    documentType: "FG_DISPATCH", idempotencyKey: key(), sourceType: "Shipment", sourceId: ctx.first.id,
    lines: [{ productId: ctx.tape.id, locationId: ctx.rm.id, quantity: 1 }],
  }), actor), "SOURCE_NOT_ALLOWED");
});
