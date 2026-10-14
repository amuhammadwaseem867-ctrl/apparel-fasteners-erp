import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { createLocation, createWarehouse, postStockDocument } from "../../server/inventory/inventory.service.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { changeBomState, createBom, updateBom } from "../../server/planning/bom.service.ts";
import { runMrp, setPlannedOrderStatus } from "../../server/planning/mrp.service.ts";
import { bomInputSchema } from "../../server/planning/planning.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder } from "../../server/sales/sales.service.ts";

const run = `P${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const items = {};
let location;

async function item(code, unit) {
  return createProduct({
    sku: `${code}-${run}`, name: `${code} ${run}`, category: "Test", productType: "Component",
    unit, unitPrice: 1, status: "ACTIVE", minimumStock: 0,
  }, actor);
}

function bom(productId, lines) {
  return bomInputSchema.parse({ productId, lines });
}

async function receive(productId, quantity) {
  await postStockDocument(stockDocumentInputSchema.parse({
    documentType: "GOODS_RECEIPT",
    idempotencyKey: randomUUID(),
    lines: [{ productId, locationId: location.id, quantity }],
  }), actor);
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test.before(async () => {
  const warehouse = await createWarehouse({ code: `PW-${run}`, name: "Planning test", warehouseType: "RAW_MATERIAL" }, actor);
  location = await createLocation({ warehouseId: warehouse.id, code: "A1", name: "A1" }, actor);
  items.ZIP = await item("ZIP", "Pcs");
  items.SLD = await item("SLD", "Pcs");
  items.TAPE = await item("TAPE", "Meters");
  items.DYE = await item("DYE", "Kgs");
});

test("BOM lifecycle: drafts are editable, approved revisions are not, revisions copy lines", async () => {
  let zip = await createBom(bom(items.ZIP.id, [{ componentId: items.SLD.id, quantity: 2, scrapPercent: 5 }]), actor);
  assert.equal(zip.revision, 1);
  assert.equal(zip.status, "DRAFT");

  zip = await updateBom(zip.id, { lines: [
    { componentId: items.SLD.id, quantity: 2, scrapPercent: 5 },
    { componentId: items.TAPE.id, quantity: 0.6, scrapPercent: 10 },
  ] }, actor);
  assert.equal(zip.lines.length, 2);
  assert.equal(zip.lines[1].quantity, "0.6");

  await changeBomState(zip.id, "approve", actor);
  await expectCode(updateBom(zip.id, { lines: [{ componentId: items.SLD.id, quantity: 1 }] }, actor), "BOM_NOT_EDITABLE");
  await expectCode(changeBomState(zip.id, "approve", actor), "BOM_STATUS_CONFLICT");
  await changeBomState(zip.id, "activate", actor);

  const tape = await createBom(bom(items.TAPE.id, [{ componentId: items.DYE.id, quantity: 0.02 }]), actor);
  await changeBomState(tape.id, "approve", actor);
  await changeBomState(tape.id, "activate", actor);

  const revised = await changeBomState(zip.id, "revise", actor);
  assert.equal(revised.revision, 2);
  assert.equal(revised.status, "DRAFT");
  assert.deepEqual(revised.lines.map((line) => [line.sku, line.quantity, line.scrapPercent]), zip.lines.map((line) => [line.sku, line.quantity, line.scrapPercent]));
});

test("a BOM that would make an item contain itself is refused", async () => {
  // Active graph: ZIP -> TAPE -> DYE. DYE containing ZIP closes a cycle.
  await expectCode(createBom(bom(items.DYE.id, [{ componentId: items.ZIP.id, quantity: 1 }]), actor), "BOM_CYCLE");
  assert.equal(bomInputSchema.safeParse({ productId: items.ZIP.id, lines: [{ componentId: items.ZIP.id, quantity: 1 }] }).success, false);
});

test("two concurrent activations leave exactly one active revision", async () => {
  const rev2 = await db.orm.public.Bom.where({ productId: items.ZIP.id, revision: 2 }).first();
  const rev3 = await changeBomState(rev2.id, "revise", actor);
  await changeBomState(rev2.id, "approve", actor);
  await changeBomState(rev3.id, "approve", actor);

  const outcomes = await Promise.allSettled([
    changeBomState(rev2.id, "activate", actor),
    changeBomState(rev3.id, "activate", actor),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ["fulfilled", "fulfilled"], "serialised, no constraint error");

  const active = await db.orm.public.Bom.where({ productId: items.ZIP.id, isActive: true }).all();
  assert.equal(active.length, 1, "partial unique index keeps one active revision");
});

test("MRP explodes approved demand through active BOMs and nets stock exactly once", async () => {
  await receive(items.ZIP.id, 100);
  await receive(items.SLD.id, 500);
  await receive(items.TAPE.id, 60);

  const customer = await createCustomer({ code: `PC-${run}`, name: "Planning customer" }, actor);
  const order = await createSalesOrder({
    customerId: customer.id,
    orderDate: "2026-10-14",
    deliveryDate: "2026-12-01",
    lines: [{ kind: "catalog", productId: items.ZIP.id, quantity: 1000, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);
  await changeSalesOrderStatus(order.id, "approve", actor);

  const result = await runMrp({}, actor);
  const req = Object.fromEntries(result.requirements.filter((row) => row.sku?.endsWith(run)).map((row) => [row.sku.split("-")[0], row]));

  assert.match(result.runNumber, /^MRP-\d{4}-\d{6}$/);
  assert.ok(result.parameters.assumptions.length > 0, "run records its assumptions");
  assert.equal(req.ZIP.netRequirement, "900");
  assert.equal(req.ZIP.supplyType, "MAKE");
  assert.ok(req.ZIP.bomRevision >= 2);
  assert.equal(req.SLD.grossRequirement, "1890");
  assert.equal(req.SLD.plannedQuantity, "1390");
  assert.equal(req.TAPE.plannedQuantity, "534");
  assert.equal(req.DYE.plannedQuantity, "10.68");

  const zipOrder = result.plannedOrders.find((row) => row.productId === items.ZIP.id);
  assert.equal(zipOrder.orderType, "MAKE");
  assert.equal(zipOrder.quantity, "900");
  assert.equal(zipOrder.dueDate, "2026-12-01");

  // Horizon before the delivery date excludes this demand.
  const early = await runMrp({ horizonDate: "2026-11-01" }, actor);
  assert.equal(early.requirements.some((row) => row.productId === items.ZIP.id), false);

  // A planned order is confirmed exactly once, even under concurrency.
  const outcomes = await Promise.allSettled([1, 2, 3].map(() => setPlannedOrderStatus(zipOrder.id, "CONFIRMED", actor)));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  await expectCode(setPlannedOrderStatus(zipOrder.id, "CANCELLED", actor), "PLANNED_ORDER_STATUS_CONFLICT");
});

test("concurrent MRP runs are serialised and numbered uniquely", async () => {
  const runs = await Promise.all([runMrp({}, actor), runMrp({}, actor)]);
  assert.notEqual(runs[0].runNumber, runs[1].runNumber);
  for (const result of runs) {
    const zip = result.requirements.find((row) => row.productId === items.ZIP.id);
    assert.equal(zip.netRequirement, "900", "each run sees the same consistent inputs");
  }
});
