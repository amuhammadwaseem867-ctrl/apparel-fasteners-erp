import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { changeProductionStatus, completeStage, createProductionOrder, getProductionOrder, recordStageRun } from "../../server/production/production.service.ts";
import { productionOrderInputSchema, stageRunInputSchema } from "../../server/production/production.validation.ts";
import { createProduct } from "../../server/products/product.service.ts";
import { changeSalesOrderStatus, createCustomer, createSalesOrder, getSalesOrder, updateCustomer } from "../../server/sales/sales.service.ts";
import { customerInputSchema, customerUpdateSchema, salesOrderInputSchema } from "../../server/sales/sales.validation.ts";

const run = `SE${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const key = () => randomUUID();
const ctx = {};

test.before(async () => {
  ctx.zip = await createProduct({ sku: `ZIP-${run}`, name: `#5 Metal Zipper Open End ${run}`, category: "Finished Goods", productType: "Finished Good", unit: "Pcs", unitPrice: 0, status: "ACTIVE", size: "#5", finish: "Gun Metal", minimumStock: 0 }, actor);
});

test("customers carry the consignee details the AF7 invoice prints, and can be edited", async () => {
  const created = await createCustomer(customerInputSchema.parse({ code: `C-${run}`, name: `Ali Traders ${run}`, address: "Plot 1, Lahore", contactPerson: "Ali", ntn: "1234567-8", strn: "32-77-8761-123-45" }), actor);
  assert.equal(created.ntn, "1234567-8");
  const updated = await updateCustomer(created.id, customerUpdateSchema.parse({ name: `Ali Traders ${run}`, address: "Plot 2, Lahore", contactPerson: "Ahmed", ntn: "1234567-8", strn: "" }), actor);
  assert.equal(updated.address, "Plot 2, Lahore");
  assert.equal(updated.contactPerson, "Ahmed");
  assert.equal(updated.strn, null);
  assert.equal(updated.code, `C-${run}`);
  ctx.customer = updated;
});

test("an order sheet keeps the customer PO and each line's tape colour, finish and size", async () => {
  const order = await createSalesOrder(salesOrderInputSchema.parse({
    customerId: ctx.customer.id, orderDate: "2026-09-17", deliveryDate: "2026-10-10", customerPo: "PO-4471",
    lines: ["Black", "Navy"].map((color) => ({ kind: "catalog", productId: ctx.zip.id, quantity: 200, unitPrice: 0, tapeColor: `${color} Same as Fabric`, size: "32 Inch" })),
  }), actor);
  const saved = await getSalesOrder(order.id);
  assert.equal(saved.customerPo, "PO-4471");
  assert.deepEqual(saved.lines.map((line) => [line.tapeColor, line.finish, line.size]), [
    ["Black Same as Fabric", "Gun Metal", "32 Inch"],
    ["Navy Same as Fabric", "Gun Metal", "32 Inch"],
  ]);
  await changeSalesOrderStatus(order.id, "approve", actor);
  ctx.order = order;
});

test("tape is weighed in kg through Tape Dyeing and Tape Press; Teeth Making counts the order's pieces", async () => {
  const production = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 400, salesOrderId: ctx.order.id, tapeKg: 12.5 }), actor);
  await changeProductionStatus(production.id, "release", "", actor);
  let state = await getProductionOrder(production.id);
  assert.equal(String(state.tapeKg), "12.5");
  assert.deepEqual(state.stages.slice(0, 3).map((stage) => [stage.unit, stage.received]), [["Kg", "12.5"], ["Kg", "0"], ["Pcs", "400"]]);

  const runStage = (stageKey, input, accepted, wastage = 0) => recordStageRun(production.id, stageKey, stageRunInputSchema.parse({ idempotencyKey: key(), inputQuantity: input, acceptedQuantity: accepted, wastageQuantity: wastage }), actor);
  await assert.rejects(runStage("tape-dyeing", 13, 13), (error) => /Only 12.5 is available/.test(error.message));
  await runStage("tape-dyeing", 12.5, 12.2, 0.3);
  await completeStage(production.id, "tape-dyeing", actor);
  await runStage("tape-press", 12.2, 12.1, 0.1);
  await completeStage(production.id, "tape-press", actor);
  state = await getProductionOrder(production.id);
  assert.equal(state.stages[1].received, "12.2");
  assert.equal(state.stages[2].available, "400");
  await runStage("teeth-making", 400, 398, 2);
  state = await getProductionOrder(production.id);
  assert.equal(state.stages[3].received, "398");
});
