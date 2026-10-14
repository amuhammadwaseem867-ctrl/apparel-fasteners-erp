import assert from "node:assert/strict";
import test from "node:test";

import { BomCycleError, calculateMrp, findBomCycle, lowLevelCodes } from "../../server/planning/mrp-engine.ts";
import { ceilDecimalString, compareDecimalStrings, multiplyDecimalStrings } from "../../server/core/utils/decimal.ts";

function input({ demand = {}, boms = {}, allocated = {}, available = {}, units = {} }) {
  return {
    demand: new Map(Object.entries(demand)),
    boms: new Map(Object.entries(boms).map(([parent, lines], index) => [parent, { bomId: `bom-${parent}`, revision: index + 1, lines }])),
    allocated: new Map(Object.entries(allocated)),
    available: new Map(Object.entries(available)),
    unitDecimals: new Map(Object.entries(units)),
  };
}

function byItem(results) {
  return Object.fromEntries(results.map((row) => [row.productId, row]));
}

test("decimal helpers multiply exactly and round planned quantities up", () => {
  assert.equal(multiplyDecimalStrings("0.1", "3"), "0.3");
  assert.equal(multiplyDecimalStrings("2.5", "1.02"), "2.55");
  assert.equal(ceilDecimalString("2.1", 0), "3");
  assert.equal(ceilDecimalString("2", 0), "2");
  assert.equal(ceilDecimalString("1.2341", 3), "1.235");
  assert.equal(compareDecimalStrings("1.50", "1.5"), 0);
});

test("a buy item nets demand against available stock", () => {
  const result = byItem(calculateMrp(input({ demand: { SLD: "1000" }, available: { SLD: "300" }, units: { SLD: 0 } })));
  assert.equal(result.SLD.netRequirement, "700");
  assert.equal(result.SLD.plannedQuantity, "700");
  assert.equal(result.SLD.supplyType, "BUY");
});

test("stock reserved for the demand is allocated first; reserved-for-others is never supply", () => {
  // The service passes only unreserved, non-held stock as available.
  const result = byItem(calculateMrp(input({ demand: { SLD: "100" }, allocated: { SLD: "40" }, available: { SLD: "25" }, units: { SLD: 0 } })));
  assert.equal(result.SLD.allocatedStock, "40");
  assert.equal(result.SLD.netRequirement, "35");
});

test("multi-level explosion applies scrap once per line and rounds up per unit", () => {
  // ZIP (made) needs 2 SLD per zip with 5% scrap, and 0.6 m of TAPE per zip with 10% scrap.
  // TAPE (made) needs 0.02 kg DYE per metre, no scrap.
  const boms = {
    ZIP: [{ componentId: "SLD", quantity: "2", scrapPercent: "5" }, { componentId: "TAPE", quantity: "0.6", scrapPercent: "10" }],
    TAPE: [{ componentId: "DYE", quantity: "0.02", scrapPercent: "0" }],
  };
  const result = byItem(calculateMrp(input({
    demand: { ZIP: "1000" },
    boms,
    available: { ZIP: "100", SLD: "500", TAPE: "60" },
    units: { ZIP: 0, SLD: 0, TAPE: 3, DYE: 3 },
  })));

  assert.equal(result.ZIP.plannedQuantity, "900");
  assert.equal(result.ZIP.supplyType, "MAKE");
  // 900 x 2 x 1.05 = 1890 gross; minus 500 available = 1390
  assert.equal(result.SLD.grossRequirement, "1890");
  assert.equal(result.SLD.plannedQuantity, "1390");
  // 900 x 0.6 x 1.10 = 594 gross; minus 60 = 534 m
  assert.equal(result.TAPE.grossRequirement, "594");
  assert.equal(result.TAPE.plannedQuantity, "534");
  // 534 x 0.02 = 10.68 kg
  assert.equal(result.DYE.plannedQuantity, "10.68");
  assert.deepEqual([result.ZIP.lowLevelCode, result.TAPE.lowLevelCode, result.DYE.lowLevelCode], [0, 1, 2]);
});

test("a component used by two parents is netted once against its total requirement", () => {
  const boms = {
    A: [{ componentId: "C", quantity: "1", scrapPercent: "0" }],
    B: [{ componentId: "C", quantity: "3", scrapPercent: "0" }],
  };
  const result = byItem(calculateMrp(input({ demand: { A: "10", B: "10" }, boms, available: { C: "15" }, units: { A: 0, B: 0, C: 0 } })));
  assert.equal(result.C.grossRequirement, "40");
  assert.equal(result.C.plannedQuantity, "25", "15 in stock netted once, not per parent");
});

test("an item demanded directly and as a component is planned at its deepest level", () => {
  const boms = { A: [{ componentId: "C", quantity: "2", scrapPercent: "0" }] };
  const results = calculateMrp(input({ demand: { A: "5", C: "4" }, boms, units: { A: 0, C: 0 } }));
  const c = byItem(results).C;
  assert.equal(c.lowLevelCode, 1);
  assert.equal(c.grossRequirement, "14");
  assert.equal(results.filter((row) => row.productId === "C").length, 1);
});

test("planned quantities are whole for counted units", () => {
  const boms = { KIT: [{ componentId: "PIN", quantity: "0.3", scrapPercent: "0" }] };
  const result = byItem(calculateMrp(input({ demand: { KIT: "7" }, boms, units: { KIT: 0, PIN: 0 } })));
  assert.equal(result.PIN.grossRequirement, "2.1");
  assert.equal(result.PIN.plannedQuantity, "3");
});

test("BOM cycles are detected and refused", () => {
  const graph = new Map([["A", ["B"]], ["B", ["C"]], ["C", ["A"]]]);
  assert.deepEqual(findBomCycle(graph), ["A", "B", "C", "A"]);
  assert.equal(findBomCycle(new Map([["A", ["B"]], ["B", ["C"]]])), null);
  assert.throws(() => lowLevelCodes(graph, ["A"]), BomCycleError);
  assert.throws(
    () => calculateMrp(input({ demand: { A: "1" }, boms: { A: [{ componentId: "A", quantity: "1", scrapPercent: "0" }] } })),
    BomCycleError,
  );
});

test("results are deterministic for the same input", () => {
  const make = () => input({
    demand: { Z: "3", Y: "2" },
    boms: { Z: [{ componentId: "X", quantity: "1", scrapPercent: "2.5" }], Y: [{ componentId: "X", quantity: "4", scrapPercent: "0" }] },
    units: { Z: 0, Y: 0, X: 0 },
  });
  assert.deepEqual(calculateMrp(make()), calculateMrp(make()));
});
