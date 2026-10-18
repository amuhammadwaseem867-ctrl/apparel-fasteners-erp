import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { passStageChecks } from "../support/stage-checks.mjs";

import { changeProductionStatus, completeStage, createProductionOrder, finishStage, getProductionOrder, recordStageRun, startStage } from "../../server/production/production.service.ts";
import { productionOrderInputSchema, stageRunInputSchema } from "../../server/production/production.validation.ts";
import { db } from "../../server/core/database/client.ts";
import { createGatePass, getGatePass } from "../../server/gate/gate-pass.service.ts";
import { gatePassInputSchema } from "../../server/gate/gate-pass.validation.ts";
import { getSetting, setSetting } from "../../server/settings/settings.service.ts";
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
  await passStageChecks(production.id, "tape-dyeing", actor);
  await completeStage(production.id, "tape-dyeing", actor);
  await runStage("tape-press", 12.2, 12.1, 0.1);
  await passStageChecks(production.id, "tape-press", actor);
  await completeStage(production.id, "tape-press", actor);
  state = await getProductionOrder(production.id);
  assert.equal(state.stages[1].received, "12.2");
  assert.equal(state.stages[2].available, "400");
  await runStage("teeth-making", 400, 398, 2);
  state = await getProductionOrder(production.id);
  assert.equal(state.stages[3].received, "398");
});

test("the simple board: start and complete each stage; Tape Dyeing takes its total kg; QC stays with Quality", async () => {
  const production = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 300, salesOrderId: ctx.order.id }), actor);
  const code = (expected) => (error) => error.code === expected;
  await assert.rejects(startStage(production.id, "tape-dyeing", actor), code("PRODUCTION_STATUS_CONFLICT"));
  await changeProductionStatus(production.id, "release", "", actor);
  await assert.rejects(startStage(production.id, "tape-press", actor), code("STAGE_NOT_STARTABLE"));

  let state = await startStage(production.id, "tape-dyeing", actor);
  assert.equal(state.status, "IN_PROGRESS");
  assert.equal(state.stages[0].status, "IN_PROGRESS");
  assert.ok(state.stages[0].startedAt);
  await assert.rejects(startStage(production.id, "tape-dyeing", actor), code("STAGE_STATUS_CONFLICT"));
  await passStageChecks(production.id, "tape-dyeing", actor);
  await assert.rejects(finishStage(production.id, "tape-dyeing", {}, actor), code("TAPE_QUANTITY_REQUIRED"));

  state = await finishStage(production.id, "tape-dyeing", { totalQuantity: 18.25 }, actor);
  assert.equal(String(state.tapeKg), "18.25");
  assert.equal(state.stages[0].status, "COMPLETED");
  assert.equal(state.stages[0].unit, "Kg");
  assert.equal(state.stages[0].acceptedQuantity, "18.25");
  // A second click changes nothing.
  state = await finishStage(production.id, "tape-dyeing", { totalQuantity: 99 }, actor);
  assert.equal(String(state.tapeKg), "18.25");

  for (const stageKey of ["tape-press", "teeth-making", "plating", "lacquer-wax", "assembling"]) {
    await startStage(production.id, stageKey, actor);
    await passStageChecks(production.id, stageKey, actor);
    state = await finishStage(production.id, stageKey, {}, actor);
  }
  assert.equal(state.stages[1].acceptedQuantity, "18.25", "Tape Press carries the kilograms");
  assert.equal(state.stages[5].acceptedQuantity, "300", "Assembling carries the order pieces");
  assert.equal(state.currentStage, "quality-check");
  await assert.rejects(finishStage(production.id, "quality-check", {}, actor), code("STAGE_MANAGED_ELSEWHERE"));
});

test("the order sheet ties each line to the item for its exact specification, reusing items it already has", async () => {
  const { createOrderFromSheet } = await import("../../server/sales/order-sheet.service.ts");
  const { orderSheetSchema } = await import("../../server/sales/sales.validation.ts");
  const line = (tapeColor) => ({ product: `Metal Zipper Open End ${run}`, variant: "Right Insert", finish: "Gun Metal", teethType: "Plain Teeth", tapeColor, slider: "Picture Puller", size: "32 Inch", unit: "Pcs", quantity: 200 });
  const sheet = (orderNumber, colors) => orderSheetSchema.parse({ customerId: ctx.customer.id, customerPo: "PO-77", orderNumber, orderDate: "2026-09-17", lines: colors.map(line) });

  const first = await getSalesOrder((await createOrderFromSheet(sheet(`AF-${run}-1`, ["Black", "Navy"]), actor)).id);
  assert.equal(first.orderNumber, `AF-${run}-1`);
  assert.equal(first.customerPo, "PO-77");
  assert.equal(first.status, "DRAFT");
  const [black, navy] = first.lines;
  assert.notEqual(black.productId, navy.productId, "a different tape colour is a different item");
  assert.deepEqual([black.teethType, black.slider, black.tapeColor, black.size, black.finish], ["Plain Teeth", "Picture Puller", "Black", "32 Inch", "Gun Metal"]);
  assert.equal(black.unitPrice, 0);

  const second = await getSalesOrder((await createOrderFromSheet(sheet(`AF-${run}-2`, ["Black"]), actor)).id);
  assert.equal(second.lines[0].productId, black.productId, "the same specification reuses its item");
  await assert.rejects(createOrderFromSheet(sheet(`AF-${run}-2`, ["Grey"]), actor), (error) => error.code === "ORDER_NUMBER_EXISTS");
});

test("Order Profile: send to production once per line, and the status follows the slowest line", async () => {
  const { createOrderFromSheet } = await import("../../server/sales/order-sheet.service.ts");
  const { getOrderTrace, overallStatus, sendOrderToProduction } = await import("../../server/sales/order-trace.service.ts");
  const { orderSheetSchema } = await import("../../server/sales/sales.validation.ts");
  const order = await createOrderFromSheet(orderSheetSchema.parse({
    customerId: ctx.customer.id, orderDate: "2026-09-17", deliveryDate: "2026-10-20",
    lines: ["Grey", "Brown"].map((tapeColor) => ({ product: `Metal Zipper ${run}`, finish: "Gun Metal", teethType: "Y-Cut", tapeColor, unit: "Pcs", quantity: 150 })),
  }), actor);
  let trace = await getOrderTrace(order.id);
  assert.equal(trace.status, "New");
  await assert.rejects(sendOrderToProduction(order.id, actor), (error) => error.code === "SALES_ORDER_NOT_APPROVED");
  await changeSalesOrderStatus(order.id, "approve", actor);
  assert.equal((await getOrderTrace(order.id)).status, "Confirmed");

  trace = await sendOrderToProduction(order.id, actor);
  assert.equal(trace.production.length, 2);
  assert.ok(trace.production.every((item) => item.status === "RELEASED" && item.dueDate === "2026-10-20"));
  assert.equal(trace.status, "In Production");
  await assert.rejects(sendOrderToProduction(order.id, actor), (error) => error.code === "ALREADY_IN_PRODUCTION");

  // The status names from the requirements, by the slowest production order.
  const at = (currentStage, status = "IN_PROGRESS", packing = "PENDING") => ({ status, currentStage, stages: [{ stageKey: "packing", status: packing }] });
  assert.equal(overallStatus("APPROVED", [at("quality-check"), at("packing")]), "QC Pending");
  assert.equal(overallStatus("APPROVED", [at("packing")]), "QC Approved");
  assert.equal(overallStatus("APPROVED", [at("packing", "IN_PROGRESS", "IN_PROGRESS")]), "Packing");
  assert.equal(overallStatus("APPROVED", [at("delivered")]), "Ready for Delivery");
  assert.equal(overallStatus("APPROVED", [at("delivered", "COMPLETED")]), "Delivered");
  assert.equal(overallStatus("APPROVED", [at("plating", "ON_HOLD")]), "On Hold");
  assert.equal(overallStatus("CANCELLED", []), "Cancelled");
});

test("an AF7 gate pass records the reference no., bags and net / gross weight per line", async () => {
  const pass = await createGatePass(gatePassInputSchema.parse({
    passType: "INWARD", partyName: `Sundar Wire ${run}`, purpose: "Brass wire for teeth making", referenceNo: "PO-88", idempotencyKey: key(),
    lines: [
      { description: "Brass wire #5", unit: "Kgs", quantity: 250.5, bags: 10, netWeight: 250.5, grossWeight: 253.25 },
      { description: "Polyester tape", unit: "Rolls", quantity: 40 },
    ],
  }), actor);
  const saved = await getGatePass(pass.id);
  assert.equal(saved.referenceNo, "PO-88");
  assert.deepEqual(saved.lines.map((line) => [line.bags, line.netWeight, line.grossWeight]), [[10, "250.5", "253.25"], [null, null, null]]);
  assert.throws(() => gatePassInputSchema.parse({ passType: "INWARD", partyName: "X Co", purpose: "Test", idempotencyKey: key(), lines: [{ description: "A", unit: "Pcs", quantity: 1, bags: -1 }] }));
});

test("the company profile keeps bank and commercial terms for the sales tax invoice", async () => {
  const before = await getSetting("company.profile");
  try {
    const saved = await setSetting("company.profile", { ...before, bankName: `Test Bank ${run}`, iban: "PK00TEST0000000000000000", productionTime: "3 weeks" }, actor);
    assert.equal(saved.bankName, `Test Bank ${run}`);
    assert.equal(saved.iban, "PK00TEST0000000000000000");
    assert.equal(saved.productionTime, "3 weeks");
  } finally {
    // Leave the test database's profile as it was.
    const { configured, ...previous } = before;
    if (configured) await setSetting("company.profile", previous, actor);
    else await db.orm.public.AppSetting.where({ key: "company.profile" }).delete();
  }
});

test("check points block a stage until every required check passes, and the completion note is kept", async () => {
  const { recordStageChecks } = await import("../../server/production/stage-checks.service.ts");
  const code = (expected) => (error) => error.code === expected;
  const production = await createProductionOrder(productionOrderInputSchema.parse({ productId: ctx.zip.id, quantity: 50, tapeKg: 4 }), actor);
  await changeProductionStatus(production.id, "release", "", actor);
  const record = (results) => recordStageChecks(production.id, "tape-dyeing", { results }, actor);

  await assert.rejects(record([{ key: "shade-match", result: "PASS" }]), code("STAGE_STATUS_CONFLICT"), "not before the stage starts");
  await startStage(production.id, "tape-dyeing", actor);
  await assert.rejects(finishStage(production.id, "tape-dyeing", {}, actor), code("STAGE_CHECKS_INCOMPLETE"));

  await assert.rejects(record([{ key: "no-such-check", result: "PASS" }]), code("CHECKPOINT_NOT_FOUND"));
  await assert.rejects(record([{ key: "shade-match", result: "NA" }]), code("CHECKPOINT_REQUIRED"));
  await assert.rejects(record([{ key: "shrinkage", result: "PASS" }]), code("CHECKPOINT_VALUE_REQUIRED"));
  await assert.rejects(record([{ key: "shade-match", result: "FAIL" }]), code("CHECKPOINT_NOTE_REQUIRED"));

  let checks = await record([
    { key: "shade-match", result: "FAIL", note: "Two shades lighter than the sample" },
    { key: "shade-even", result: "PASS" },
    { key: "color-fastness", result: "PASS" },
    { key: "shrinkage", result: "PASS", value: "1.5" },
  ]);
  assert.match(checks.problem, /Failed check: Shade matches the approved sample/);
  await assert.rejects(finishStage(production.id, "tape-dyeing", {}, actor), code("STAGE_CHECKS_INCOMPLETE"));
  let state = await getProductionOrder(production.id);
  assert.equal(state.stages[0].status, "IN_PROGRESS", "nothing was recorded by the refused completion");
  assert.equal(state.stages[0].acceptedQuantity, "0");

  checks = await record([{ key: "shade-match", result: "PASS", note: "Re-dyed; matches now" }]);
  assert.equal(checks.problem, null);
  state = await finishStage(production.id, "tape-dyeing", { note: "Lot 7, dyed twice" }, actor);
  const dyeing = state.stages[0];
  assert.equal(dyeing.status, "COMPLETED");
  assert.equal(dyeing.completionNote, "Lot 7, dyed twice");
  assert.deepEqual(dyeing.checks.points.map((point) => [point.key, point.result, point.value]), [
    ["shade-match", "PASS", null], ["shade-even", "PASS", null], ["color-fastness", "PASS", null], ["shrinkage", "PASS", "1.5"],
  ]);
  await assert.rejects(record([{ key: "shade-match", result: "PASS" }]), code("STAGE_STATUS_CONFLICT"), "a completed stage's checks are closed");
  assert.equal(state.stages[6].checks, null, "Quality Check is checked by its inspection");
});

test("notes left at a process step show on the Order Profile with who wrote them", async () => {
  const { addOrderNote, getOrderTrace } = await import("../../server/sales/order-trace.service.ts");
  const user = await db.orm.public.User.where({ status: "ACTIVE" }).first();
  assert.ok(user, "the test database has a user");
  await addOrderNote(ctx.order.id, { step: "qc", note: "Passed QC; 2 pieces re-waxed" }, user.id);
  const trace = await addOrderNote(ctx.order.id, { step: "dispatch", note: "Sent with Ali Goods, vehicle LEA-123" }, user.id);
  const own = trace.notes.filter((note) => ["Passed QC; 2 pieces re-waxed", "Sent with Ali Goods, vehicle LEA-123"].includes(note.note));
  assert.deepEqual(own.map((note) => [note.step, note.createdByName]), [["qc", user.name], ["dispatch", user.name]]);
  assert.equal((await getOrderTrace(ctx.order.id)).notes.length, trace.notes.length);
  await assert.rejects(addOrderNote(randomUUID(), { step: "qc", note: "x" }, user.id), (error) => error.code === "SALES_ORDER_NOT_FOUND");
});

test("the bell counts only real waiting work, and only in the areas the user may see", async () => {
  const { attentionFor } = await import("../../server/dashboard/attention.service.ts");
  const none = await attentionFor([]);
  assert.deepEqual(none, { items: [], total: 0 });

  const draftCount = Number((await db.orm.public.SalesOrder.where({ status: "DRAFT" }).all()).length);
  const salesOnly = await attentionFor(["sales:view"]);
  assert.ok(salesOnly.items.every((item) => item.key === "orders-draft"), "sales users see only order work");
  assert.equal(salesOnly.items[0]?.count ?? 0, draftCount);
  assert.equal(salesOnly.total, draftCount);

  const everything = await attentionFor(["sales:view", "production:view", "quality:view", "dispatch:view", "inventory:view", "finance:view"]);
  assert.ok(everything.items.every((item) => item.count > 0 && item.href.startsWith("/")), "only non-zero items are listed");
  assert.equal(everything.total, everything.items.reduce((sum, item) => sum + item.count, 0));
});
