/*
 * Pure tests for the location helpers behind typed location entry (D-046 /
 * D-050) — no database. The database-backed cases (finding or creating a
 * location in the MAIN warehouse) run under npm run test:db only.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { locationCodeFor } from "../../server/inventory/stock-rules.ts";

test("typed location names become safe, collision-free codes", () => {
  assert.equal(locationCodeFor("Shelf 3 / Row 2"), "SHELF-3-ROW-2");
  assert.equal(locationCodeFor("rack a"), "RACK-A");
  assert.equal(locationCodeFor("  Spaced   Name  "), "SPACED-NAME");
});

test("long names truncate so two names can share a code by design", () => {
  // First 30 normalized characters; the unique (warehouse, code) index then
  // resolves the second name to the first location rather than failing.
  const long = "A".repeat(40);
  assert.equal(locationCodeFor(long).length, 30);
  assert.equal(locationCodeFor(`${long}B`).length, 30);
});

test("names with no usable characters still produce a code", () => {
  assert.equal(locationCodeFor("///"), "LOCATION");
  assert.equal(locationCodeFor(""), "LOCATION");
});
