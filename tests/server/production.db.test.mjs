import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { passStageChecks } from "../support/stage-checks.mjs";

import { db } from "../../server/core/database/client.ts";
import { createLocation, createWarehouse, postStockDocument } from "../../server/inventory/inventory.service.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { changeBomState, createBom } from "../../server/planning/bom.service.ts";
import { runMrp, setPlannedOrderStatus } from "../../server/planning/mrp.service.ts";
import { bomInputSchema } from "../../server/planning/planning.validation.ts";
import {
  changeProductionStatus,
  completeStage,
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  recordStageRun,
} from "../../server/production/production.service.ts";
import {
  productionOrderInputSchema,
  productionQuerySchema,
  stageRunInputSchema,
} from "../../server/production/production.validation.ts";
import { changePackingList, createPackingList } from "../../server/packing/packing.service.ts";
import { packingListInputSchema } from "../../server/packing/packing.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { createInspection, decideInspection } from "../../server/quality/quality.service.ts";
import { inspectionInputSchema } from "../../server/quality/quality.validation.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `R${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const items = {};

const STAGE_KEYS = [
  "tape-dyeing", "tape-press", "teeth-making", "plating", "lacquer-wax",
  "assembling", "quality-check", "packing", "delivered",
];

async function item(code, unit) {
  return createProduct({
    sku: `${code}-${run}`, name: `${code} ${run}`, category: "Test", productType: "Component",
    unit, unitPrice: 1, status: "ACTIVE", minimumStock: 0,
  }, actor);
}

function order(input) {
  return createProductionOrder(productionOrderInputSchema.parse(input), actor);
}

function stageRun(id, stageKey, quantities, idempotencyKey = randomUUID()) {
  return recordStageRun(id, stageKey, stageRunInputSchema.parse({ idempotencyKey, ...quantities }), actor);
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test.before(async () => {
  items.ZIP = await item("ZIP", "Pcs");
  items.SLD = await item("SLD", "Pcs");
  items.TAPE = await item("TAPE", "Meters");
  const bom = await createBom(bomInputSchema.parse({
    productId: items.ZIP.id,
    lines: [{ componentId: items.SLD.id, quantity: 1 }, { componentId: items.TAPE.id, quantity: 0.6, scrapPercent: 10 }],
  }), actor);
  await changeBomState(bom.id, "approve", actor);
  await changeBomState(bom.id, "activate", actor);
});

test("a new order has the nine stages in order, the active BOM and its material requirement", async () => {
  const created = await order({ productId: items.ZIP.id, quantity: 1000, priority: "HIGH", dueDate: "2026-12-01" });

  assert.match(created.orderNumber, /^PRD-\d{4}-\d{6}$/);
  assert.equal(created.status, "PLANNED");
  assert.equal(created.currentStage, "tape-dyeing");
  assert.deepEqual(created.stages.map((stage) => stage.stageKey), STAGE_KEYS);
  assert.deepEqual(created.stages.map((stage) => stage.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(created.stages[0].available, "1000");
  assert.equal(created.stages[1].available, "1000", "no blockers (D-048): every stage can take the whole order");
  assert.equal(created.bomRevision, 1);
  assert.deepEqual(created.materials.map((line) => line.required), ["1000", "660"]);
  assert.equal(created.events[0].eventType, "CREATED");

  await expectCode(order({ productId: items.ZIP.id, quantity: 1.5 }), "QUANTITY_PRECISION");
});

test("runs are refused until release; partial runs, rework and balance rules are enforced exactly", async () => {
  const { id } = await order({ productId: items.TAPE.id, quantity: 100.5 });

  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 10, acceptedQuantity: 10 }), "STAGE_RUN_INVALID");
  await changeProductionStatus(id, "release", "", actor);

  // Parts must add up to the input.
  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 10, acceptedQuantity: 9 }), "STAGE_RUN_INVALID");
  // Cannot process more than received.
  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 100.6, acceptedQuantity: 100.6 }), "STAGE_RUN_INVALID");
  // Unit precision (Meters: 3 decimals).
  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 1.2345, acceptedQuantity: 1.2345 }), "QUANTITY_PRECISION");

  let state = (await stageRun(id, "tape-dyeing", { inputQuantity: 60.1, acceptedQuantity: 55.1, rejectedQuantity: 2, wastageQuantity: 1, reworkQuantity: 2 })).order;
  assert.equal(state.status, "IN_PROGRESS");
  let dyeing = state.stages[0];
  assert.equal(dyeing.processedQuantity, "60.1");
  assert.equal(dyeing.available, "42.4", "100.5 + 2 rework - 60.1 processed");
  assert.equal(state.stages[1].available, "100.5", "no blockers (D-048): the next stage can take the whole order");

  // No blockers (D-048): stage 2 can be worked and completed while stage 1 is open.
  await stageRun(id, "tape-press", { inputQuantity: 55.1, acceptedQuantity: 55.1 });
  assert.equal((await completeStage(id, "tape-press", actor)).stages[1].status, "COMPLETED");

  state = (await stageRun(id, "tape-dyeing", { inputQuantity: 42.4, acceptedQuantity: 42.4 })).order;
  dyeing = state.stages[0];
  assert.equal(dyeing.available, "0");
  assert.equal(dyeing.acceptedQuantity, "97.5");
  assert.equal(dyeing.runs.length, 2);
  assert.deepEqual(dyeing.runs.map((runRow) => runRow.runNo), [1, 2]);

  await passStageChecks(id, "tape-dyeing", actor);
  state = await completeStage(id, "tape-dyeing", actor);
  assert.equal(state.currentStage, "tape-press");
  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 1, acceptedQuantity: 1 }), "STAGE_RUN_INVALID");
  await expectCode(completeStage(id, "tape-dyeing", actor), "STAGE_NOT_COMPLETABLE");
});

test("hold blocks work and resume restores the previous status; cancel only before work starts", async () => {
  const { id } = await order({ productId: items.SLD.id, quantity: 50 });
  await expectCode(changeProductionStatus(id, "hold", "", actor), "PRODUCTION_STATUS_CONFLICT");
  await changeProductionStatus(id, "release", "", actor);
  await stageRun(id, "tape-dyeing", { inputQuantity: 5, acceptedQuantity: 5 });

  let state = await changeProductionStatus(id, "hold", "Machine breakdown", actor);
  assert.equal(state.status, "ON_HOLD");
  await expectCode(stageRun(id, "tape-dyeing", { inputQuantity: 5, acceptedQuantity: 5 }), "STAGE_RUN_INVALID");
  await expectCode(completeStage(id, "tape-dyeing", actor), "PRODUCTION_STATUS_CONFLICT");
  await expectCode(changeProductionStatus(id, "cancel", "", actor), "PRODUCTION_STATUS_CONFLICT");

  state = await changeProductionStatus(id, "resume", "", actor);
  assert.equal(state.status, "IN_PROGRESS");
  assert.equal(state.holdFromStatus, null);
  const hold = state.events.find((event) => event.eventType === "STATUS_HOLD");
  assert.equal(hold.details.reason, "Machine breakdown");

  const other = await order({ productId: items.SLD.id, quantity: 10 });
  assert.equal((await changeProductionStatus(other.id, "cancel", "", actor)).status, "CANCELLED");
});

test("an idempotent replay records a run once; concurrent runs never exceed the available quantity", async () => {
  const { id } = await order({ productId: items.SLD.id, quantity: 10 });
  await changeProductionStatus(id, "release", "", actor);

  const key = randomUUID();
  const replays = await Promise.all([1, 2, 3].map(() => stageRun(id, "tape-dyeing", { inputQuantity: 2, acceptedQuantity: 2 }, key)));
  assert.equal(replays.filter((result) => !result.replayed).length, 1);
  let state = await getProductionOrder(id);
  assert.equal(state.stages[0].processedQuantity, "2");
  assert.equal(state.stages[0].runs.length, 1);

  // Five concurrent runs of 3 against 8 available: at most two succeed.
  const outcomes = await Promise.allSettled([1, 2, 3, 4, 5].map(() => stageRun(id, "tape-dyeing", { inputQuantity: 3, acceptedQuantity: 3 })));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 2);
  for (const outcome of outcomes.filter((item) => item.status === "rejected")) {
    assert.equal(outcome.reason.code, "STAGE_RUN_INVALID");
  }
  state = await getProductionOrder(id);
  assert.equal(state.stages[0].processedQuantity, "8");
  assert.deepEqual(state.stages[0].runs.map((runRow) => runRow.runNo), [1, 2, 3]);
});

test("the order completes only when all nine stages complete in sequence", async () => {
  const { id } = await order({ productId: items.SLD.id, quantity: 4 });
  await changeProductionStatus(id, "release", "", actor);

  // Stages 7 and 8 are driven by Quality and Packing (D-022); Delivered is
  // recorded by hand because this is a make-to-stock order.
  const warehouse = await createWarehouse({ code: `RF-${run}`, name: "FG test", warehouseType: "FINISHED_GOODS" }, actor);
  const fg = await createLocation({ warehouseId: warehouse.id, code: "F1", name: "F1" }, actor);

  let state;
  for (const stageKey of STAGE_KEYS) {
    if (stageKey === "quality-check") {
      // Lose one unit to rejection at quality check.
      const inspection = await createInspection(inspectionInputSchema.parse({
        idempotencyKey: randomUUID(), inspectionType: "FINAL", productionOrderId: id,
        inspectedQuantity: 4, passedQuantity: 3, rejectedQuantity: 1,
      }), actor);
      await decideInspection(inspection.id, "approve", "", actor);
    } else if (stageKey === "packing") {
      const list = await createPackingList(packingListInputSchema.parse({
        idempotencyKey: randomUUID(), productionOrderId: id, locationId: fg.id,
        packages: [{ packageType: "Polybag", quantity: 3 }],
      }), actor);
      await changePackingList(list.id, "confirm", actor);
    } else {
      const quantity = STAGE_KEYS.indexOf(stageKey) > STAGE_KEYS.indexOf("quality-check") ? 3 : 4;
      await stageRun(id, stageKey, { inputQuantity: quantity, acceptedQuantity: quantity });
      await passStageChecks(id, stageKey, actor);
    }
    state = await completeStage(id, stageKey, actor);
  }

  assert.equal(state.status, "COMPLETED");
  assert.ok(state.completedAt);
  assert.equal(state.progress, 100);
  assert.equal(state.deliveredQuantity, "3");
  await expectCode(changeProductionStatus(id, "hold", "", actor), "PRODUCTION_STATUS_CONFLICT");

  const listed = await listProductionOrders(productionQuerySchema.parse({ status: "COMPLETED", search: `SLD-${run}` }));
  assert.ok(listed.orders.some((row) => row.id === id && row.progress === 100));
});

test("a confirmed MAKE planned order converts once; links to unapproved sales orders are refused", async () => {
  const customer = await createCustomer({ code: `RC-${run}`, name: "Production customer" }, actor);
  const salesOrder = await createSalesOrder({
    customerId: customer.id,
    orderDate: "2026-10-14",
    deliveryDate: "2026-12-15",
    lines: [{ kind: "catalog", productId: items.ZIP.id, quantity: 300, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);
  await expectCode(order({ productId: items.ZIP.id, quantity: 300, salesOrderId: salesOrder.id }), "SALES_ORDER_NOT_APPROVED");
  await changeSalesOrderStatus(salesOrder.id, "approve", actor);

  const mrp = await runMrp({}, actor);
  const planned = mrp.plannedOrders.find((row) => row.productId === items.ZIP.id);
  assert.ok(planned, "MRP suggests making the zipper");
  await expectCode(order({ productId: items.ZIP.id, quantity: 1, plannedOrderId: planned.id }), "PLANNED_ORDER_NOT_CONVERTIBLE");
  await setPlannedOrderStatus(planned.id, "CONFIRMED", actor);

  const input = { productId: items.ZIP.id, quantity: Number(planned.quantity), plannedOrderId: planned.id, salesOrderId: salesOrder.id };
  const outcomes = await Promise.allSettled([order(input), order(input)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "PLANNED_ORDER_ALREADY_CONVERTED");

  const converted = await db.orm.public.ProductionOrder.where({ plannedOrderId: planned.id }).all();
  assert.equal(converted.length, 1);
  const stages = await db.orm.public.ProductionStage.where({ productionOrderId: converted[0].id }).all();
  assert.equal(stages.length, 9, "the losing transaction left no orphan stages");
});

test("malformed ids are a 404, not a database error", async () => {
  await expectCode(getProductionOrder("not-a-uuid"), "PRODUCTION_ORDER_NOT_FOUND");
  await expectCode(changeProductionStatus(randomUUID(), "release", "", actor), "PRODUCTION_ORDER_NOT_FOUND");
});

test("material is issued only to open production orders and is listed on the order", async () => {
  const warehouse = await createWarehouse({ code: `RW-${run}`, name: "Production test", warehouseType: "RAW_MATERIAL" }, actor);
  const location = await createLocation({ warehouseId: warehouse.id, code: "A1", name: "A1" }, actor);
  const post = (documentType, sourceId, quantity = 5) => postStockDocument(stockDocumentInputSchema.parse({
    documentType,
    idempotencyKey: randomUUID(),
    sourceType: sourceId === undefined ? undefined : "ProductionOrder",
    sourceId,
    lines: [{ productId: items.SLD.id, locationId: location.id, quantity }],
  }), actor);
  await post("GOODS_RECEIPT", undefined, 100);

  const { id } = await order({ productId: items.ZIP.id, quantity: 10 });
  await expectCode(post("MATERIAL_ISSUE", id), "PRODUCTION_ORDER_NOT_OPEN");
  await expectCode(post("MATERIAL_ISSUE", "not-an-order"), "PRODUCTION_ORDER_NOT_OPEN");
  await changeProductionStatus(id, "release", "", actor);
  await expectCode(post("GOODS_RECEIPT", id), "SOURCE_NOT_ALLOWED");

  const issued = await post("MATERIAL_ISSUE", id);
  const state = await getProductionOrder(id);
  assert.deepEqual(state.materialIssues.map((document) => document.id), [issued.document.id]);
});
