import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { changeGatePass, createGatePass, listGatePasses, recordGatePassReturn } from "../../server/gate/gate-pass.service.ts";
import { gatePassInputSchema, gatePassQuerySchema } from "../../server/gate/gate-pass.validation.ts";

const actor = randomUUID();
const create = (input) => createGatePass(gatePassInputSchema.parse({ idempotencyKey: randomUUID(), partyName: "Ali Plating Works", purpose: "Job work: nickel plating", ...input }), actor);

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test("returnable passes need a return date; lines or a shipment are required", () => {
  assert.equal(gatePassInputSchema.safeParse({ idempotencyKey: randomUUID(), passType: "OUTWARD_RETURNABLE", partyName: "X Co", purpose: "Repair", lines: [{ description: "Die", unit: "Pcs", quantity: 1 }] }).success, false);
  assert.equal(gatePassInputSchema.safeParse({ idempotencyKey: randomUUID(), passType: "INWARD", partyName: "X Co", purpose: "Delivery", lines: [] }).success, false);
});

test("a returnable pass goes out once and completes when everything is back", async () => {
  const pass = await create({
    passType: "OUTWARD_RETURNABLE", expectedReturnDate: "2026-10-01", vehicleNumber: "LEB-221",
    lines: [{ description: "Zipper sliders, raw", unit: "Pcs", quantity: 5000 }, { description: "Slider mould", unit: "Pcs", quantity: 1 }],
  });
  assert.match(pass.passNumber, /^GP-\d{4}-\d{6}$/);
  await expectCode(changeGatePass(pass.id, "pass", { guardName: "Gate 1" }, actor), "GATE_PASS_STATUS_CONFLICT");
  await expectCode(recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 1 }], actor), "GATE_PASS_NOT_OUT");

  await changeGatePass(pass.id, "approve", {}, actor);
  const outcomes = await Promise.allSettled([1, 2, 3].map(() => changeGatePass(pass.id, "pass", { guardName: "Gate 1" }, actor)));
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1, "the gate movement is recorded once");
  let state = outcomes.find((outcome) => outcome.status === "fulfilled").value;
  assert.deepEqual([state.status, state.guardName, state.overdue], ["OUT", "Gate 1", true]);
  assert.ok((await listGatePasses(gatePassQuerySchema.parse({ overdue: "true", search: pass.passNumber }))).gatePasses.length === 1);

  await expectCode(changeGatePass(pass.id, "cancel", { reason: "too late" }, actor), "GATE_PASS_STATUS_CONFLICT");
  state = await recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 3000 }], actor);
  assert.equal(state.status, "OUT");
  assert.equal(state.lines[0].outstanding, "2000");
  await expectCode(recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 2001 }], actor), "RETURN_EXCEEDS_OUT");

  // Concurrent returns of the last 2000 in two halves plus one extra: never over-returned.
  const returns = await Promise.allSettled([
    recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 1000 }], actor),
    recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 1000 }], actor),
    recordGatePassReturn(pass.id, [{ lineId: pass.lines[0].id, quantity: 1000 }], actor),
  ]);
  assert.equal(returns.filter((outcome) => outcome.status === "fulfilled").length, 2);
  state = await recordGatePassReturn(pass.id, [{ lineId: pass.lines[1].id, quantity: 1 }], actor);
  assert.equal(state.status, "COMPLETED");
  assert.ok(state.closedAt);
});

test("non-returnable and inward passes complete at the gate; drafts can be cancelled", async () => {
  const outward = await create({ passType: "OUTWARD_NON_RETURNABLE", lines: [{ description: "Scrap tape", unit: "Kgs", quantity: 12.5 }] });
  await changeGatePass(outward.id, "approve", {}, actor);
  assert.equal((await changeGatePass(outward.id, "pass", { guardName: "Gate 2" }, actor)).status, "COMPLETED");

  const inward = await create({ passType: "INWARD", partyName: "Supplier", purpose: "Returned dies", lines: [{ description: "Die", unit: "Pcs", quantity: 2 }] });
  const cancelled = await changeGatePass(inward.id, "cancel", { reason: "Duplicate" }, actor);
  assert.deepEqual([cancelled.status, cancelled.cancelReason], ["CANCELLED", "Duplicate"]);
});
