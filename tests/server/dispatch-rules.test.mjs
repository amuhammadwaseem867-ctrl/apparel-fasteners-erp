import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateToReservations,
  nextShipmentStatus,
  overShipment,
  sumByProduct,
} from "../../server/dispatch/dispatch-rules.ts";

test("quantities are summed per item exactly", () => {
  const totals = sumByProduct([
    { productId: "a", quantity: "0.1" },
    { productId: "a", quantity: "0.2" },
    { productId: "b", quantity: "5" },
  ]);
  assert.equal(totals.get("a"), "0.3");
  assert.equal(totals.get("b"), "5");
});

test("a shipment cannot take an item past the ordered quantity", () => {
  const ordered = new Map([["a", "100"], ["b", "10.5"]]);
  const shipped = new Map([["a", "60"]]);

  assert.equal(overShipment(ordered, shipped, new Map([["a", "40"], ["b", "10.5"]])), null, "exactly the remainder is allowed");
  assert.deepEqual(overShipment(ordered, shipped, new Map([["a", "40.001"]])), {
    productId: "a", ordered: "100", shipped: "60", requested: "40.001", remaining: "40",
  });
  assert.equal(overShipment(ordered, shipped, new Map([["c", "1"]]))?.remaining, "0", "an item not on the order has nothing remaining");
});

test("dispatch consumes reservations oldest first, then unreserved stock", () => {
  assert.deepEqual(allocateToReservations("25", [{ id: "r1", open: "10" }, { id: "r2", open: "0" }, { id: "r3", open: "8" }]), [
    { reservationId: "r1", quantity: "10" },
    { reservationId: "r3", quantity: "8" },
    { reservationId: null, quantity: "7" },
  ]);
  assert.deepEqual(allocateToReservations("4", [{ id: "r1", open: "10" }]), [{ reservationId: "r1", quantity: "4" }]);
  assert.deepEqual(allocateToReservations("1.5", []), [{ reservationId: null, quantity: "1.5" }]);
});

test("shipment status moves draft -> dispatched -> delivered; only drafts cancel", () => {
  assert.equal(nextShipmentStatus("dispatch", "DRAFT"), "DISPATCHED");
  assert.equal(nextShipmentStatus("deliver", "DISPATCHED"), "DELIVERED");
  assert.equal(nextShipmentStatus("deliver", "DRAFT"), null);
  assert.equal(nextShipmentStatus("cancel", "DISPATCHED"), null);
  assert.equal(nextShipmentStatus("cancel", "DRAFT"), "CANCELLED");
});
