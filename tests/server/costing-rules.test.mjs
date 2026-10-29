/*
 * D-055: the costing engine reproduces the master costing sheet. With the
 * sheet's own wastage (0.02 kg) the numbers match its cells; the owner's
 * answers (tape 90 / 75 m per kg, wastage by meters, dyeing and plating
 * per meter) are checked separately.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_COSTING_RATES, costOrder, gaugeOf, sizeInCm, wastageKg } from "../../server/costing/costing-rules.ts";

const close = (actual, expected, digits = 4) => assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} != ${expected}`);
const sheetWastage = { ...DEFAULT_COSTING_RATES, wastageSmallKg: 0.02, wastageMediumKg: 0.02, wastageLargeKgPer1000m: 0 };
const line = (lineNo, productName, size, quantity, finish = "Shiny Black") => ({ lineNo, productName, size, finish, quantity });

test("gauge and size are read from the order sheet", () => {
  assert.equal(gaugeOf("#5 Metal Zipper Open End"), "5");
  assert.equal(gaugeOf("#4.5 Metal Zipper Close End"), "4.5");
  assert.equal(gaugeOf("4.5# Y-Cut"), "4.5");
  assert.equal(gaugeOf("Metal zipper"), null);
  close(sizeInCm("24 Inch"), 60.96);
  close(sizeInCm("12.5 cm"), 12.5);
  close(sizeInCm("19.5\""), 49.53);
  assert.equal(sizeInCm(""), null);
});

test("#4.5 Y-Cut AF-26-1146 (9,000 pcs): meters, rolls, brass, wastage and pieces items match the sheet", () => {
  const lines = [[12, 1459], [12.5, 3400], [13, 2695], [13.5, 1201], [14, 245]]
    .map(([cm, qty], index) => line(index + 1, "#4.5 Metal Zipper Close End", `${cm} cm`, qty, "Shiny Nickel"));
  const { sections } = costOrder(lines, sheetWastage, 0);
  const [section] = sections;
  assert.equal(section.pieces, 9000);
  close(section.meters, 1461.865);
  close(section.rolls, 7.309325);
  close(section.brassKg, 29.6181312);
  close(section.wastage.rolls, 0.0026315789);
  close(section.wastage.meters, 0.5263157895);
  close(section.wastage.brassKg, 0.0154736842);
  close(section.wastage.tapeKg, 0.0058479532);
  close(section.scrap.value, 35.2026315789);
  const expense = (key) => section.items.find((item) => item.key === key).expense;
  close(expense("brass"), 103717.6170947, 3);
  close(expense("bottom-stop"), 6511.05, 3);
  close(expense("puller"), 81000);
  close(expense("top-stop"), 4498.11, 3);
  close(expense("packing"), 1350);
  // Owner's answer: 1 kg of #4.5 tape is 90 m (the sheet divided by 100).
  close(section.tapeKg, 1461.865 / 90);
});

test("#5 open end AF-26-414 (395 pcs): gap brass is recovered with the wastage at 65%", () => {
  const lines = [[19.5, 47], [20.5, 100], [21.5, 100], [22, 100], [22, 48]]
    .map(([inches, qty], index) => line(index + 1, "#5 Metal Zipper Open End", `${inches} Inch`, qty));
  const [section] = costOrder(lines, sheetWastage, 0).sections;
  assert.equal(section.end, "Open end");
  close(section.meters, 228.4615);
  close(section.rolls, 2.284615);
  close(section.brassKg, 8.779306455);
  close(section.scrap.kg, 0.7558115227);
  close(section.scrap.value, 1719.4712142, 3);
  close(section.items.find((item) => item.key === "puller").expense, 12403);
  close(section.items.find((item) => item.key === "top-stop").expense, 487.43, 3);
  assert.ok(section.items.some((item) => item.key === "pin-box") && !section.items.some((item) => item.key === "bottom-stop"), "open end: pin box set, no bottom stop");
  // Owner's answer: 1 kg of #5 tape is 75 m.
  close(section.tapeKg, 228.4615 / 75);
});

test("wastage follows the note: 0.04 kg under 1,000 m, 0.2 kg to 2,000 m, then 0.1 kg per 1,000 m", () => {
  assert.equal(wastageKg(0, DEFAULT_COSTING_RATES), 0);
  assert.equal(wastageKg(999, DEFAULT_COSTING_RATES), 0.04);
  assert.equal(wastageKg(1461.865, DEFAULT_COSTING_RATES), 0.2);
  close(wastageKg(3000, DEFAULT_COSTING_RATES), 0.3);
});

test("dyeing per meter on all tape, plating per meter only on plated finishes; totals and profit add up", () => {
  const order = costOrder([
    line(1, "#5 Metal Zipper Close End", "7 Inch", 1000, "Antique Brass"),
    line(2, "#5 Metal Zipper Close End", "7 Inch", 1000, "Gun Metal"),
    line(3, "#4.5 Metal Zipper Open End", "26 Inch", 100, "Shiny Silver"),
    line(4, "Packing tape", "", 5, ""),
  ], DEFAULT_COSTING_RATES, 50000);
  assert.deepEqual(order.sections.map((section) => `${section.gauge} ${section.end}`), ["4.5 Open end", "5 Close end"]);
  assert.deepEqual(order.skipped.map((row) => row.lineNo), [4]);
  const five = order.sections[1];
  const dyeing = five.items.find((item) => item.key === "dyeing");
  const plating = five.items.find((item) => item.key === "plating");
  close(dyeing.required, five.meters);
  close(plating.required, five.meters / 2, 6);
  assert.ok(!order.sections[0].items.some((item) => item.key === "plating"), "Shiny Silver is not a plated finish");
  close(five.materialCost, five.totalExpense - five.scrap.value, 6);
  close(order.totals.materialCost, order.sections[0].materialCost + five.materialCost, 6);
  close(order.totals.profit, 50000 - order.totals.materialCost, 6);
  close(order.totals.perPiece, order.totals.materialCost / 2100, 6);
});
