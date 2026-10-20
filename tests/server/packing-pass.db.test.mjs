import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { passStageChecks } from "../support/stage-checks.mjs";

import { db } from "../../server/core/database/client.ts";
import { createLocation, createWarehouse } from "../../server/inventory/inventory.service.ts";
import { createPackingList, getPackingList } from "../../server/packing/packing.service.ts";
import { packingListInputSchema } from "../../server/packing/packing.validation.ts";
import { changeProductionStatus, completeStage, createProductionOrder, getProductionOrder, recordStageRun } from "../../server/production/production.service.ts";
import { productionOrderInputSchema, stageRunInputSchema } from "../../server/production/production.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { createInspection, decideInspection } from "../../server/quality/quality.service.ts";
import { inspectionInputSchema } from "../../server/quality/quality.validation.ts";

const run = `PP${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const key = () => randomUUID();
const ctx = {};
const EARLY_STAGES = ["tape-dyeing", "tape-press", "teeth-making", "plating", "lacquer-wax", "assembling"];
const rows = [
  { packageType: "Carton", description: "#5 Metal Zipper Open End", size: "24 Inch", quantity: 600, bags: 6, netWeight: 30, grossWeight: 32 },
  { packageType: "Carton", description: "#5 Metal Zipper Open End", size: "24 Inch", quantity: 50, bags: 1, netWeight: 2.5, grossWeight: 2.8 },
];
const pass = (packages, extra = {}) => createPackingList(packingListInputSchema.parse({
  idempotencyKey: key(), productionOrderId: ctx.order.id, locationId: ctx.fg.id, confirm: true, packages, ...extra,
}), actor);

test.before(async () => {
  ctx.zip = await createProduct({ sku: `ZIP-${run}`, name: `Zipper ${run}`, category: "Test", productType: "Finished Good", unit: "Pcs", unitPrice: 1, status: "ACTIVE", minimumStock: 0 }, actor);
  const warehouse = await createWarehouse({ code: `PP-${run}`, name: "FG", warehouseType: "FINISHED_GOODS" }, actor);
  ctx.fg = await createLocation({ warehouseId: warehouse.id, code: "F1", name: "FG Shelf 1" }, actor);
  ctx.order = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 700 }), actor);
  await changeProductionStatus(ctx.order.id, "release", "", actor);
  for (const stageKey of EARLY_STAGES) {
    await recordStageRun(ctx.order.id, stageKey, stageRunInputSchema.parse({ idempotencyKey: key(), inputQuantity: 700, acceptedQuantity: 700 }), actor);
    await passStageChecks(ctx.order.id, stageKey, actor);
    await completeStage(ctx.order.id, stageKey, actor);
  }
  const inspection = await createInspection(inspectionInputSchema.parse({ idempotencyKey: key(), inspectionType: "FINAL", productionOrderId: ctx.order.id, inspectedQuantity: 700, passedQuantity: 700 }), actor);
  await decideInspection(inspection.id, "approve", "", actor);
  await completeStage(ctx.order.id, "quality-check", actor);
});

test("packing is passed in one step with the AF7 packing list rows", async () => {
  const list = await pass(rows);
  assert.equal(list.status, "CONFIRMED", "passed without a second step");
  assert.equal(list.totalQuantity, "650");
  assert.equal(list.packageCount, 7, "bags / cartons of all rows");
  assert.deepEqual(list.packages.map((item) => [item.description, item.size, item.quantity, item.bags, item.netWeight, item.grossWeight]), [
    ["#5 Metal Zipper Open End", "24 Inch", "600", 6, "30", "32"],
    ["#5 Metal Zipper Open End", "24 Inch", "50", 1, "2.5", "2.8"],
  ]);
  assert.deepEqual(list.stockDocuments.map((document) => document.documentType), ["FG_RECEIPT"]);
  const balance = await db.orm.public.StockBalance.where({ productId: ctx.zip.id, locationId: ctx.fg.id }).first();
  assert.equal(String(balance.onHand), "650", "packed goods are in finished-goods stock");
  const packing = (await getProductionOrder(ctx.order.id)).stages.find((stage) => stage.stageKey === "packing");
  assert.equal(packing.acceptedQuantity, "650", "the packing stage is recorded");
  assert.deepEqual(list.history.map((entry) => entry.event), ["Packing list made", "Packing passed: stock received"]);
  ctx.list = list;
});

test("a pass that packs more than passed QC leaves nothing behind", async () => {
  const before = await db.orm.public.PackingList.where({ productionOrderId: ctx.order.id }).all();
  await assert.rejects(pass([{ packageType: "Carton", quantity: 60, bags: 1 }]), (error) => error.code === "PACKING_EXCEEDS_AVAILABLE");
  const after = await db.orm.public.PackingList.where({ productionOrderId: ctx.order.id }).all();
  assert.equal(after.length, before.length);
  assert.equal(packingListInputSchema.safeParse({ idempotencyKey: key(), productionOrderId: ctx.order.id, locationId: ctx.fg.id, packages: [{ packageType: "Carton", quantity: 1, bags: 0 }] }).success, false, "a row is at least one bag");

  const rest = await pass([{ packageType: "Bag", quantity: 50, bags: 2 }], { confirm: false });
  assert.equal(rest.status, "DRAFT", "a draft can still be saved and passed later");
  assert.deepEqual((await getPackingList(ctx.list.id)).history.length, 2);
});
