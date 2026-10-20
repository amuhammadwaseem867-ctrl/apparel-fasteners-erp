import assert from "node:assert/strict";
import test from "node:test";

import { processSteps, recordForPath, stepForPath } from "../../lib/process/processSteps.js";
import { checksProblem } from "../../server/production/stage-checks.service.ts";

const KEYS = ["tape-dyeing", "tape-press", "teeth-making", "plating", "lacquer-wax", "assembling", "quality-check", "packing", "delivered"];
const production = (doneUpTo, extra = {}) => ({
  id: "p1", orderNumber: "PRD-1", status: "IN_PROGRESS",
  stages: KEYS.map((stageKey, index) => ({ stageKey, label: stageKey, status: index < doneUpTo ? "COMPLETED" : index === doneUpTo ? "IN_PROGRESS" : "PENDING" })),
  ...extra,
});
const trace = (order, rest = {}) => ({ order: { id: "o1", status: "APPROVED", ...order }, status: "", production: [], packingLists: [], shipments: [], invoices: [], money: { invoiced: 0, paid: 0, outstanding: 0 }, ...rest });
const states = (flow) => flow.steps.map((step) => step.state[0]).join("");

test("a draft order waits at its invoice; everything after it is blocked behind it", () => {
  const flow = processSteps(trace({ status: "DRAFT" }, { invoices: [{ id: "i1", invoiceNumber: "AF7-26-0001", status: "DRAFT" }] }));
  assert.equal(states(flow), "cwwwww");
  assert.equal(flow.steps[0].label, "Invoice", "the invoice comes first (D-048)");
  assert.match(flow.next.action, /Approve invoice/);
  assert.match(processSteps(trace({ status: "DRAFT" })).next.action, /Confirm order/, "an order without an invoice is confirmed on its own");
});

test("a confirmed order is sent to production next; nothing blocks it (D-048)", () => {
  assert.match(processSteps(trace({})).next.action, /Send the order to production/);
  const failing = production(2);
  failing.stages[2].checks = { points: [{ result: "FAIL" }] };
  const flow = processSteps(trace({}, { production: [failing] }));
  assert.equal(states(flow), "dcwwww");
  assert.equal(flow.next.blocker, undefined, "a failed check is recorded, not a blocker");
  assert.match(flow.next.action, /PRD-1: complete teeth-making/);
});

test("after Assembling the next step is QC, then packing, dispatch and payment", () => {
  assert.match(processSteps(trace({}, { production: [production(6)] })).next.action, /Record QC for PRD-1/);
  assert.match(processSteps(trace({}, { production: [production(7)] })).next.action, /Make the packing list/);
  assert.match(processSteps(trace({}, { production: [production(8)], packingLists: [{ id: "l1", packingNumber: "PKL-1", status: "CONFIRMED" }] })).next.action, /Create the shipment/);
  const delivered = { production: [production(9, { status: "COMPLETED" })], shipments: [{ id: "s1", shipmentNumber: "SHP-1", status: "DISPATCHED", dispatchedAt: "2026-10-18" }] };
  assert.match(processSteps(trace({}, delivered)).next.action, /Approve the invoice/);
  const invoiced = { ...delivered, invoices: [{ id: "i1", invoiceNumber: "AF7-26-0001", status: "ISSUED" }], money: { invoiced: 100, paid: 40, outstanding: 60 } };
  const flow = processSteps(trace({}, invoiced));
  assert.equal(states(flow), "dddddc");
  assert.match(flow.next.action, /outstanding 60/);
  const paid = processSteps(trace({}, { ...invoiced, money: { invoiced: 100, paid: 100, outstanding: 0 } }));
  assert.equal(paid.complete, true);
  assert.equal(paid.next, null);
});

test("every next step is passed on the order page; no step sends the user elsewhere", () => {
  const cases = [
    { production: [production(6)] },
    { production: [production(6)], inspections: [{ id: "q1", inspectionNumber: "QI-1", status: "OPEN" }] },
    { production: [production(7)] },
    { production: [production(7)], packingLists: [{ id: "l1", packingNumber: "PKL-1", status: "DRAFT" }] },
    { production: [production(8)], packingLists: [{ id: "l1", packingNumber: "PKL-1", status: "CONFIRMED" }], shipments: [{ id: "s1", shipmentNumber: "SHP-1", status: "DRAFT" }] },
    { production: [production(9, { status: "COMPLETED" })], shipments: [{ id: "s1", shipmentNumber: "SHP-1", status: "DISPATCHED", dispatchedAt: "2026-10-18" }] },
    { production: [production(9, { status: "COMPLETED" })], shipments: [{ id: "s1", shipmentNumber: "SHP-1", status: "DISPATCHED", dispatchedAt: "2026-10-18" }], invoices: [{ id: "i1", invoiceNumber: "INV-1", status: "DRAFT" }] },
    { production: [production(9, { status: "COMPLETED" })], shipments: [{ id: "s1", shipmentNumber: "SHP-1", status: "DISPATCHED", dispatchedAt: "2026-10-18" }], invoices: [{ id: "i1", invoiceNumber: "INV-1", status: "ISSUED" }], money: { invoiced: 100, paid: 0, outstanding: 100 } },
  ];
  for (const extra of cases) {
    const { next } = processSteps(trace({}, extra));
    assert.match(next.href, /^\/sales\/orders\/[^/#]+#step-/, `${next.step.key}: ${next.href}`);
  }
  assert.match(processSteps(trace({}, cases[1])).next.action, /Approve QC inspection QI-1/);
  assert.match(processSteps(trace({}, cases[3])).next.action, /Pass packing list PKL-1/);
});

test("a cancelled order shows as blocked at Order", () => {
  const flow = processSteps(trace({ status: "CANCELLED" }));
  assert.match(flow.next.blocker, /cancelled/);
});

test("pages map to their process step and their record", () => {
  assert.equal(stepForPath("/sales/orders/new"), "order");
  assert.equal(stepForPath("/quality/final"), "qc");
  assert.equal(stepForPath("/finance/receivables"), "payment");
  assert.equal(stepForPath("/inventory/stock"), null);
  const id = "3f1c2a9e-1d2b-4c3d-8e9f-0a1b2c3d4e5f";
  assert.deepEqual(recordForPath(`/sales/orders/${id}/edit`), { salesOrderId: id });
  assert.deepEqual(recordForPath(`/dispatch/gate-passes/${id}`), { api: `/api/gate-passes/${id}` });
  assert.deepEqual(recordForPath("/quality/final", new URLSearchParams({ productionOrderId: id })), { api: `/api/production/orders/${id}` });
  assert.equal(recordForPath("/sales/orders"), null);
});

test("check points: a failure blocks, a missing required check blocks, optional ones do not", () => {
  const points = [{ key: "a", label: "A", required: true }, { key: "b", label: "B", required: false }];
  assert.match(checksProblem(points, []), /Record the check points first: A/);
  assert.match(checksProblem(points, [{ checkKey: "a", result: "PASS" }, { checkKey: "b", result: "FAIL" }]), /Failed check: B/);
  assert.equal(checksProblem(points, [{ checkKey: "a", result: "PASS" }]), null);
  assert.equal(checksProblem([], []), null);
});

test("the top bar names the page from the menu", async () => {
  const { navEntryFor } = await import("../../config/navigation.js");
  assert.equal(navEntryFor("/finance/invoices/new").label, "New invoice", "orders are made from invoices (D-048)");
  assert.equal(navEntryFor("/sales/orders/3f1c2a9e-1d2b-4c3d-8e9f-0a1b2c3d4e5f").label, "Orders");
  assert.equal(navEntryFor("/dispatch/gate-passes/abc").parent, "Dispatch");
  assert.equal(navEntryFor("/dashboard").label, "Dashboard");
  assert.equal(navEntryFor("/nowhere"), null);
});
