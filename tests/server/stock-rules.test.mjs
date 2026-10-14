import assert from "node:assert/strict";
import test from "node:test";

import {
  addDecimalStrings,
  decimalSign,
  normalizeDecimalString,
  subtractDecimalStrings,
} from "../../server/core/utils/decimal.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import {
  STOCK_DOCUMENT_TYPES,
  documentNumber,
  orderForLocking,
  quantityPrecisionError,
  unitDecimals,
} from "../../server/inventory/stock-rules.ts";

const P = "00000000-0000-4000-8000-000000000001";
const L1 = "00000000-0000-4000-8000-0000000000a1";
const L2 = "00000000-0000-4000-8000-0000000000a2";

function parse(documentType, lines, extra = {}) {
  return stockDocumentInputSchema.safeParse({ documentType, idempotencyKey: "key-12345678", lines, ...extra });
}

test("countable units take whole quantities; measured units take three decimals", () => {
  assert.equal(unitDecimals("Pcs"), 0);
  assert.equal(unitDecimals(" gross "), 0);
  assert.equal(unitDecimals("Meters"), 3);
  assert.equal(unitDecimals("Kgs"), 3);
  assert.equal(quantityPrecisionError(10, "Pcs"), null);
  assert.match(quantityPrecisionError(1.5, "Pcs"), /whole number/);
  assert.equal(quantityPrecisionError(1.125, "Meters"), null);
  assert.match(quantityPrecisionError(1.1255, "Meters"), /at most 3 decimal places/);
});

test("balance updates are applied in a fixed order so documents cannot deadlock", () => {
  const ops = [
    { productId: "b", locationId: "2" },
    { productId: "a", locationId: "9" },
    { productId: "b", locationId: "1" },
  ];
  assert.deepEqual(orderForLocking(ops).map((op) => op.productId + op.locationId), ["a9", "b1", "b2"]);
  assert.deepEqual(orderForLocking([...ops].reverse()), orderForLocking(ops));
});

test("document numbers are zero-padded per prefix and year", () => {
  assert.equal(documentNumber("GRN", 2026, 7), "GRN-2026-000007");
  assert.equal(new Set(Object.values(STOCK_DOCUMENT_TYPES).map((rule) => rule.prefix)).size, Object.keys(STOCK_DOCUMENT_TYPES).length);
});

test("document validation enforces reasons, signs, destinations and reservation use", () => {
  assert.equal(parse("GOODS_RECEIPT", [{ productId: P, locationId: L1, quantity: 5 }]).success, true);
  assert.equal(parse("GOODS_RECEIPT", [{ productId: P, locationId: L1, quantity: -5 }]).success, false);
  assert.equal(parse("ADJUSTMENT", [{ productId: P, locationId: L1, quantity: -5 }]).success, false, "reason required");
  assert.equal(parse("ADJUSTMENT", [{ productId: P, locationId: L1, quantity: -5 }], { reason: "damage found" }).success, true);
  assert.equal(parse("ADJUSTMENT", [{ productId: P, locationId: L1, quantity: 0 }], { reason: "x" }).success, false);
  assert.equal(parse("COUNT", [{ productId: P, locationId: L1, quantity: 0 }]).success, true, "counting zero is valid");
  assert.equal(parse("COUNT", [{ productId: P, locationId: L1, quantity: 1 }, { productId: P, locationId: L1, quantity: 2 }]).success, false);
  assert.equal(parse("TRANSFER", [{ productId: P, locationId: L1, quantity: 1 }]).success, false, "destination required");
  assert.equal(parse("TRANSFER", [{ productId: P, locationId: L1, toLocationId: L1, quantity: 1 }]).success, false);
  assert.equal(parse("TRANSFER", [{ productId: P, locationId: L1, toLocationId: L2, quantity: 1 }]).success, true);
  assert.equal(parse("GOODS_RECEIPT", [{ productId: P, locationId: L1, quantity: 1, reservationId: P }]).success, false);
  assert.equal(parse("MATERIAL_ISSUE", [{ productId: P, locationId: L1, quantity: 1, reservationId: P }]).success, true);
  assert.equal(parse("NOT_A_TYPE", [{ productId: P, locationId: L1, quantity: 1 }]).success, false);
});

test("decimal string arithmetic is exact for stock quantities", () => {
  assert.equal(subtractDecimalStrings("21", "19.000"), "2");
  assert.equal(subtractDecimalStrings("0.1", "0.3"), "-0.2");
  assert.equal(addDecimalStrings("0.1", "0.2"), "0.3");
  assert.equal(addDecimalStrings("999999999999.999", "0.001"), "1000000000000");
  assert.equal(normalizeDecimalString("5.000"), "5");
  assert.equal(decimalSign("-0.001"), -1);
  assert.equal(decimalSign("0.000"), 0);
});

test("SKU suggestions are deterministic and keep every specification distinct", async () => {
  const { suggestSku } = await import("../../lib/inventory/sku.js");
  const base = { category: "Sliders", size: "#5", itemType: "DA", finish: "Antique Silver", logoType: "Plain" };

  assert.equal(suggestSku(base), "SLI-5-DA-ANSI-PL");
  assert.equal(suggestSku(base), suggestSku({ ...base }), "same input, same SKU");
  assert.notEqual(suggestSku(base), suggestSku({ ...base, logoType: "Logo" }));
  assert.notEqual(suggestSku(base), suggestSku({ ...base, finish: "Antique Brass" }));
  assert.equal(suggestSku({ category: "Teeth", size: "#4.5", material: "Brass" }), "TEE-45-BRAS");
  assert.equal(suggestSku({ category: "Sliders", size: "620 SS", finish: "Golden Brass", logoType: "Logo" }), "SLI-620SS-GOBR-LG");
  assert.equal(suggestSku({ category: "Pin Box", size: "#5", itemType: "Pin Box", finish: "Antique Silver" }), "PIBO-5-ANSI", "type repeating the category is dropped");
  assert.equal(suggestSku({ category: "Two Pins", itemType: "Two Pins", finish: "Antique Silver" }), "TWPI-ANSI");
});

test("the fastener catalogue keeps every required specification distinct", async () => {
  const { buildCatalog, matchesCatalogEntry, CATEGORY_LABELS } = await import("../../lib/inventory/catalog.js");
  const catalog = buildCatalog();
  const keys = catalog.map((entry) => [entry.category, entry.size, entry.type, entry.material, entry.finish, entry.variant, entry.logo].join("|"));

  assert.equal(new Set(keys).size, catalog.length, "no two catalogue entries share a specification");
  assert.equal(new Set(catalog.map((entry) => entry.sku)).size, catalog.length, "catalogue SKUs are unique");

  // Owner requirement spot checks.
  assert.ok(catalog.some((entry) => entry.category === "teeth" && entry.size === "#5" && entry.type === "Y-Cut" && entry.material === "Brass"));
  assert.ok(catalog.some((entry) => entry.category === "sliders" && entry.size === "#5 Thumb" && entry.variant === "L"));
  assert.ok(catalog.some((entry) => entry.category === "sliders" && entry.size === "#5 Thumb" && entry.variant === "S"));
  assert.equal(catalog.filter((entry) => entry.size === "620 SS" && entry.finish === "Antique Silver").length, 2, "Logo and Plain are separate items");

  const entry = catalog.find((item) => item.category === "pin-box" && item.finish === "Gun Metal");
  const product = { category: CATEGORY_LABELS["pin-box"], size: "5", itemType: "Pin Box", finish: "gun metal", material: null, variant: "", logoType: null };
  assert.equal(matchesCatalogEntry(product, entry), true);
  assert.equal(matchesCatalogEntry({ ...product, finish: "Black Oxide" }, entry), false);
});
