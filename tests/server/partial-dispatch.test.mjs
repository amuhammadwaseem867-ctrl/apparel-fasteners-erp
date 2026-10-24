/*
 * Pure tests for partial dispatch of a packing list (D-050) — no database.
 * The database-backed cases (stock deductions, stage runs, concurrency) run
 * under npm run test:db against the isolated test database only.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  packedOutstanding,
  packedOutstandingAgainst,
} from "../../server/dispatch/dispatch-rules.ts";
import { shipmentLineSchema } from "../../server/dispatch/dispatch.validation.ts";

const LIST_ID = "11111111-1111-4111-8111-111111111111";

/* The shipped quantity counts only dispatched and delivered shipments. */
function lines(rows) {
  return rows.map(([status, quantity]) => ({ status, quantity }));
}

test("outstanding packed quantity ignores drafts and cancelled shipments", () => {
  // Packed 1000; shipment 1 dispatched with 600, a draft of 400 exists.
  assert.equal(packedOutstanding("1000", lines([["DISPATCHED", "600"], ["DRAFT", "400"]])), "400");
  // A cancelled shipment never consumed its quantity either.
  assert.equal(packedOutstanding("1000", lines([["DISPATCHED", "600"], ["CANCELLED", "400"]])), "400");
  // Two partial dispatches leave the last part.
  assert.equal(packedOutstanding("1000", lines([["DISPATCHED", "600"], ["DELIVERED", "250"]])), "150");
  // The final shipment completes the packed quantity.
  assert.equal(packedOutstanding("1000", lines([["DISPATCHED", "600"], ["DELIVERED", "250"], ["DISPATCHED", "150"]])), "0");
  // Nothing shipped yet: everything is outstanding.
  assert.equal(packedOutstanding("1000", []), "1000");
  // Over-dispatch cannot happen through the calculation, but the guard is 0.
  assert.equal(packedOutstanding("100", lines([["DISPATCHED", "150"]])), "0");
});

test("a packed shipment line takes a packing list with a positive quantity", () => {
  const full = shipmentLineSchema.safeParse({ packingListId: LIST_ID });
  assert.equal(full.success, true, "no quantity means the whole list");

  const partial = shipmentLineSchema.safeParse({ packingListId: LIST_ID, quantity: 600 });
  assert.equal(partial.success, true, "a part of the list can be shipped");

  const zero = shipmentLineSchema.safeParse({ packingListId: LIST_ID, quantity: 0 });
  assert.equal(zero.success, false, "zero quantity is refused");

  const negative = shipmentLineSchema.safeParse({ packingListId: LIST_ID, quantity: -5 });
  assert.equal(negative.success, false, "a negative quantity is refused");

  const both = shipmentLineSchema.safeParse({ packingListId: LIST_ID, productId: LIST_ID, quantity: 5 });
  assert.equal(both.success, false, "a line cannot be both packed and loose");

  const loose = shipmentLineSchema.safeParse({ productId: LIST_ID });
  assert.equal(loose.success, false, "a loose line still needs a quantity");
});

test("outstanding against dispatch counts drafts; outstanding against creation reserves them", () => {
  const lines = [
    { status: "DISPATCHED", quantity: "600" },
    { status: "DRAFT", quantity: "250" },
  ];
  // The dispatch guard ignores the open draft: a cancelled draft holds nothing.
  assert.equal(packedOutstanding("1000", lines), "400");
  // Creating another shipment must not promise the draft's units.
  assert.equal(packedOutstandingAgainst("1000", lines, ["DISPATCHED", "DELIVERED", "DRAFT"]), "150");
  // Cancelling the draft returns its units to both views.
  const cancelled = lines.map((line) => (line.status === "DRAFT" ? { ...line, status: "CANCELLED" } : line));
  assert.equal(packedOutstanding("1000", cancelled), "400");
  assert.equal(packedOutstandingAgainst("1000", cancelled, ["DISPATCHED", "DELIVERED", "DRAFT"]), "400");
});

test("the schema still accepts the original full-list and loose lines", () => {
  assert.equal(shipmentLineSchema.safeParse({ packingListId: LIST_ID }).success, true);
  assert.equal(shipmentLineSchema.safeParse({ productId: LIST_ID, quantity: 10 }).success, true);
});
