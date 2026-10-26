import assert from "node:assert/strict";
import test from "node:test";

import {
  FINAL_STAGE,
  STAGES,
  completionError,
  nextOrderStatus,
  runError,
  stageProgress,
  stageQuantities,
} from "../../server/production/production-rules.ts";

function stages(overrides = {}) {
  return STAGES.map((stage) => ({
    sequence: stage.sequence,
    status: "PENDING",
    processedQuantity: "0",
    acceptedQuantity: "0",
    rejectedQuantity: "0",
    wastageQuantity: "0",
    reworkQuantity: "0",
    ...overrides[stage.sequence],
  }));
}

const run = (input, accepted, rejected = "0", wastage = "0", rework = "0") => ({
  inputQuantity: input, acceptedQuantity: accepted, rejectedQuantity: rejected, wastageQuantity: wastage, reworkQuantity: rework,
});
const ctx = (available, stageStatus = "IN_PROGRESS", orderStatus = "IN_PROGRESS") => ({ available, stageStatus, orderStatus });

test("the nine required stages are in the required order", () => {
  assert.deepEqual(STAGES.map((stage) => stage.label), [
    "Tape Dyeing", "Tape Press", "Teeth Making", "Plating", "Lacquer & Wax",
    "Assembling", "Quality Check", "Packing", "Delivered",
  ]);
  assert.equal(FINAL_STAGE.key, "delivered");
});

test("no blockers (D-048): every stage can take the whole order, whatever the stage before it has done", () => {
  const s = stages({ 1: { processedQuantity: "600", acceptedQuantity: "580", rejectedQuantity: "15", wastageQuantity: "5" } });
  assert.deepEqual(stageQuantities(s, "1000", 1), { received: "1000", available: "400", previousCompleted: true, inKg: false });
  assert.deepEqual(stageQuantities(s, "1000", 2), { received: "1000", available: "1000", previousCompleted: false, inKg: false });
  assert.equal(stageQuantities(s, "1000", 9).available, "1000", "even the last stage, before anything else is done");
});

test("with a tape weight, Tape Dyeing and Tape Press run in kilograms and Teeth Making restarts from the order pieces", () => {
  const s = stages({
    1: { status: "COMPLETED", processedQuantity: "25.5", acceptedQuantity: "25", wastageQuantity: "0.5" },
    2: { status: "COMPLETED", processedQuantity: "25", acceptedQuantity: "24.8", wastageQuantity: "0.2" },
  });
  assert.deepEqual(stageQuantities(s, "800", 1, "25.5"), { received: "25.5", available: "0", previousCompleted: true, inKg: true });
  assert.deepEqual(stageQuantities(s, "800", 2, "25.5"), { received: "25.5", available: "0.5", previousCompleted: true, inKg: true });
  assert.deepEqual(stageQuantities(s, "800", 3, "25.5"), { received: "800", available: "800", previousCompleted: true, inKg: false });
  // Without a tape weight nothing changes: every stage stays in the order's unit.
  assert.equal(stageQuantities(stages({}), "800", 1, null).received, "800");
  assert.equal(stageQuantities(stages({}), "800", 1, "0").inKg, false);
});

test("rework returns units to the same stage's queue", () => {
  const s = stages({
    6: { status: "COMPLETED", processedQuantity: "100", acceptedQuantity: "100" },
    7: { processedQuantity: "100", acceptedQuantity: "90", rejectedQuantity: "2", reworkQuantity: "8" },
  });
  assert.equal(stageQuantities(s, "100", 7).available, "8");
});

test("a run must balance and may not exceed what is available", () => {
  assert.equal(runError(run("100", "95", "3", "2"), ctx("100")), null);
  assert.match(runError(run("100", "95", "3"), ctx("100")), /must equal the input quantity/);
  assert.match(runError(run("101", "101"), ctx("100")), /Only 100 is available/);
  assert.match(runError(run("0", "0"), ctx("100")), /greater than zero/);
  assert.match(runError(run("5", "6", "-1"), ctx("100")), /cannot be negative/);
  assert.equal(runError(run("0.5", "0.25", "0.25"), ctx("1")), null, "exact decimals");
});

test("runs are refused on held, planned or cancelled orders", () => {
  assert.match(runError(run("1", "1"), ctx("10", "PENDING", "ON_HOLD")), /on hold/);
  assert.match(runError(run("1", "1"), ctx("10", "PENDING", "PLANNED")), /planned/);
  assert.match(runError(run("1", "1"), ctx("10", "PENDING", "CANCELLED")), /cancelled/);
});

test("a completed stage or order still takes later work, within what is available (D-053)", () => {
  assert.equal(runError(run("1", "1"), ctx("10", "COMPLETED", "IN_PROGRESS")), null);
  assert.equal(runError(run("1", "1"), ctx("10", "COMPLETED", "COMPLETED")), null);
  assert.match(runError(run("11", "11"), ctx("10", "COMPLETED", "COMPLETED")), /Only 10 is available/);
});

test("no blockers (D-048): a stage can be completed at any time, but only once", () => {
  assert.equal(completionError({ available: "0", previousCompleted: false }, "PENDING"), null, "before the previous stage");
  assert.equal(completionError({ available: "3", previousCompleted: true }, "IN_PROGRESS"), null, "with units not recorded");
  assert.match(completionError({ available: "0", previousCompleted: true }, "COMPLETED"), /already completed/);
});

test("order transitions are explicit and restricted", () => {
  assert.equal(nextOrderStatus("release", "PLANNED"), "RELEASED");
  assert.equal(nextOrderStatus("release", "IN_PROGRESS"), null);
  assert.equal(nextOrderStatus("hold", "IN_PROGRESS"), "ON_HOLD");
  assert.equal(nextOrderStatus("resume", "ON_HOLD", "IN_PROGRESS"), "IN_PROGRESS");
  assert.equal(nextOrderStatus("resume", "IN_PROGRESS"), null);
  assert.equal(nextOrderStatus("cancel", "IN_PROGRESS"), null, "work in progress cannot simply be cancelled");
  assert.equal(nextOrderStatus("cancel", "COMPLETED"), null);
  assert.equal(stageProgress(stages({ 1: { status: "COMPLETED" }, 2: { status: "COMPLETED" }, 3: { status: "COMPLETED" } })), 33);
});
