/*
 * D-058: the inventory sheet's balances become one product per item and
 * one balance per item and location; a bad file is refused before
 * anything is changed.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { importSql, locationCodeFor, readImport, skuFor } from "../../scripts/import-inventory.mjs";

const item = (extra) => ({
  sheet: "Sliders Stock", row: 1, category: "Sliders", productType: "Raw Material", name: "Slider #4.5 A/S 480 Logo — Antique Silver",
  size: "#4.5", material: "", itemType: "A/S 480 Logo", finish: "Antique Silver", color: "", variant: "", unit: "Pcs",
  quantity: 100, location: "Line 2-Box-6", unitWeightGrams: 2.083, unitPrice: 8.5, ...extra,
});

test("teeth keep the raw material list's SKUs; other items get a stable SKU from their name", () => {
  assert.equal(skuFor({ category: "Teeth", size: "#4.5", itemType: "Y-Cut", material: "Brass" }), "TEE-45-YCU-BRAS");
  assert.equal(skuFor({ category: "Teeth", size: "#5", itemType: "Plain", material: "Aluminium" }), "TEE-5-PLAI-ALUM");
  assert.equal(skuFor(item()), skuFor(item({ quantity: 5, location: "" })), "the same item wherever it is");
  assert.notEqual(skuFor(item()), skuFor(item({ finish: "Antique Brass" })));
  assert.match(skuFor(item()), /^SLI-SLIDER-4.5-A-S-480-LOGO-ANTIQUE-SILVER-[0-9A-F]{5}$/);
});

test("the same item in the same place adds up; a blank place is General; empty balances are left out", () => {
  const plan = readImport({ items: [item(), item({ row: 2, quantity: 50.4 }), item({ row: 3, location: "" , quantity: 7 }), item({ row: 4, finish: "Gun Metal", quantity: 0 })] });
  assert.equal(plan.products.length, 2);
  assert.deepEqual(plan.balances.map((balance) => [balance.location, balance.quantity]), [["Line 2-Box-6", 150], ["General", 7]]);
  assert.equal(locationCodeFor("Line 2-Box-6"), "LINE-2-BOX-6");
});

test("a file with a negative quantity, an unknown unit or a bad rate is refused", () => {
  assert.throws(() => readImport({ items: [item({ quantity: -1 })] }), /quantity -1 is not a stock quantity/);
  assert.throws(() => readImport({ items: [item({ unit: "Box" })] }), /unit Box is not Pcs, Kgs or Mtr/);
  assert.throws(() => readImport({ items: [item({ unitPrice: "8.5" })] }), /unitPrice 8.5 is not a positive number/);
  assert.throws(() => readImport({ items: [] }), /no items/);
});

test("one opening Stock In document; quotes in names cannot break the SQL", () => {
  const sql = importSql(readImport({ items: [item({ name: "Wax 'J-Tex' string", location: "Rack's 2" })] }), "2026-11-06").join(";\n");
  assert.equal((sql.match(/insert into erp_stock_documents/g) ?? []).length, 1);
  assert.match(sql, /'SIN-2026-' \|\| lpad/);
  assert.match(sql, /'Wax ''J-Tex'' string'/);
  assert.match(sql, /'Rack''s 2'/);
});

test("stops, bottoms and sliders use the raw material list's items; pins and boxes stay apart", async () => {
  const { listedSku } = await import("../../scripts/import-inventory.mjs");
  const listed = [
    { sku: "BOT-45-ANBR", category: "Bottom", size: "#4.5", itemType: "Bottom", finish: "Antique Brass" },
    { sku: "BOT-45-ALUM", category: "Bottom", size: "#4.5", itemType: "Bottom", finish: "Aluminium" },
    { sku: "TOST-5-ALUM", category: "Top Stops", size: "#5", itemType: "Top Stop", finish: "Aluminium" },
    { sku: "SLI-45480-ANSI-STAN-LG", category: "Sliders", size: "#4.5 480", itemType: "Slider", finish: "Antique Silver", variant: "Standard", logoType: "Logo" },
    { sku: "SLI-45480-ANSI-STAN-PL", category: "Sliders", size: "#4.5 480", itemType: "Slider", finish: "Antique Silver", variant: "Standard", logoType: "Plain" },
    { sku: "SLI-620SS-ANSI-STAN-PL", category: "Sliders", size: "620 SS", itemType: "Slider", finish: "Antique Silver", variant: "Standard", logoType: "Plain" },
    { sku: "PIBO-5-GOBR", category: "Pin Box", size: "#5", itemType: "Pin Box", finish: "Golden Brass" },
  ];
  assert.equal(listedSku({ category: "Bottom", name: "Bottom 4.5# Antique Brass", size: "#4.5", finish: "Antique Brass" }, listed), "BOT-45-ANBR");
  assert.equal(listedSku({ category: "Bottom", name: "Bottom Aluminum 4.5# Antique Silver", size: "#4.5", finish: "Antique Silver" }, listed), "BOT-45-ALUM");
  assert.equal(listedSku({ category: "Top Stops", name: "Top Stop 5# Aluminium", size: "#5", finish: "Aluminium" }, listed), "TOST-5-ALUM");
  assert.equal(listedSku({ category: "Sliders", name: "Slider", size: "#4.5", itemType: "A/S 480 Logo", finish: "Antique Silver" }, listed), "SLI-45480-ANSI-STAN-LG");
  assert.equal(listedSku({ category: "Sliders", name: "Slider", size: "#4.5", itemType: "A/S 480 No Logo", finish: "Antique Silver" }, listed), "SLI-45480-ANSI-STAN-PL");
  assert.equal(listedSku({ category: "Sliders", name: "Slider", size: "#4.5", itemType: "A/S 620 No Logo", finish: "Antique Silver" }, listed), "SLI-620SS-ANSI-STAN-PL");
  assert.equal(listedSku({ category: "Sliders", name: "Slider", size: "#4.5", itemType: "A/S 650 Logo", finish: "Antique Silver" }, listed), null, "no 650 on the list");
  assert.equal(listedSku({ category: "Pin Box", name: "Box #5", size: "#5", finish: "Golden Brass" }, listed), null);
});
