import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import { createLocation, createWarehouse, locationCodeFor, postStockDocument, resolveTypedLocation, setLocationStatus } from "../../server/inventory/inventory.service.ts";
import { rawMaterialQuerySchema, stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import { addStandardRawMaterials, getItemStockCard, getRawMaterialStock, piecesAndKg, standardRawMaterials } from "../../server/inventory/raw-material.service.ts";
import { createProduct, getProduct } from "../../server/products/product.service.ts";
import { matchesCatalogEntry } from "../../lib/inventory/catalog.js";

const run = `RM${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
const key = () => randomUUID();
const stock = (filters) => getRawMaterialStock(rawMaterialQuerySchema.parse(filters));
const post = (documentType, productId, locationId, quantity, extra = {}) => postStockDocument(stockDocumentInputSchema.parse({
  documentType, idempotencyKey: key(), reason: "Test", lines: [{ productId, locationId, quantity }], ...extra,
}), actor);

test("AF7's raw material list is added once, active, with #4.5 teeth as Y-Cut", async () => {
  const list = standardRawMaterials();
  assert.deepEqual(
    list.filter((entry) => entry.category === "teeth" && entry.size === "#4.5").map((entry) => entry.type),
    ["Y-Cut", "Y-Cut"],
  );
  assert.equal(list.filter((entry) => entry.category === "bottom" && entry.size === "#5").length, 7, "#5 bottoms include Shiny Silver");

  await addStandardRawMaterials(actor);
  const products = await db.orm.public.Product.all();
  for (const entry of list) {
    const match = products.find((product) => matchesCatalogEntry(product, entry));
    assert.ok(match, `missing ${entry.name}`);
    assert.equal(match.status, "ACTIVE", entry.name);
  }
  const teeth = products.find((product) => matchesCatalogEntry(product, list.find((entry) => entry.category === "teeth")));
  assert.equal(teeth.unit, "Kgs", "teeth are kept in kg");

  const again = await addStandardRawMaterials(actor);
  assert.deepEqual(again.created, [], "running it again never duplicates items");

  // A #4.5 tooth saved as Plain is corrected to Y-Cut; an inactive item is made active.
  const brass45 = products.find((product) => matchesCatalogEntry(product, list.find((entry) => entry.category === "teeth" && entry.size === "#4.5")));
  const slider = products.find((product) => matchesCatalogEntry(product, list.find((entry) => entry.category === "sliders")));
  await db.orm.public.Product.where({ id: brass45.id }).update({ itemType: "Plain" });
  await db.orm.public.Product.where({ id: slider.id }).update({ status: "INACTIVE" });
  const fixed = await addStandardRawMaterials(actor);
  assert.deepEqual(fixed.created, []);
  assert.ok(fixed.corrected.includes(brass45.sku));
  assert.ok(fixed.activated.includes(slider.sku));
  assert.equal((await getProduct(brass45.id)).itemType, "Y-Cut");
  assert.equal((await getProduct(slider.id)).status, "ACTIVE");
  assert.equal((await stock({})).standardList.missing, 0);
});

test("live raw material count: received less issued, shown in pieces and kg", async () => {
  const warehouse = await createWarehouse({ code: `W-${run}`, name: "Main", warehouseType: "GENERAL" }, actor);
  const location = await createLocation({ warehouseId: warehouse.id, code: "S1-R1-C1", name: "Shelf 1" }, actor);
  const topStop = await createProduct({ sku: `TS-${run}`, name: `Top Stop #5 Gun Metal ${run}`, category: "Top Stops", productType: "Raw Material", unit: "Pcs", unitPrice: 0, status: "ACTIVE", size: "#5", itemType: "Top Stop", finish: "Gun Metal", minimumStock: 6000, unitWeightGrams: 0.25 }, actor);
  const product = await createProduct({ sku: `FG-${run}`, name: `#5 Zipper ${run}`, category: "Finished Goods", productType: "Finished Good", unit: "Pcs", unitPrice: 0, status: "ACTIVE", minimumStock: 0 }, actor);
  assert.equal(topStop.unitWeightGrams, 0.25);

  await post("GOODS_RECEIPT", topStop.id, location.id, 10000);
  await post("MATERIAL_ISSUE", topStop.id, location.id, 5000);
  let [row] = (await stock({ search: topStop.sku })).items;
  assert.deepEqual([row.received, row.issued, row.onHand, row.available], ["10000", "5000", "5000", "5000"]);
  assert.deepEqual([row.pieces, row.kg], ["5000", "1.25"]);
  assert.equal(row.stockStatus, "LOW", "below the 6000 minimum");
  assert.equal(row.locations, "Shelf 1", "the location as it was named");

  await post("MATERIAL_RETURN", topStop.id, location.id, 1000);
  [row] = (await stock({ search: topStop.sku })).items;
  assert.deepEqual([row.returned, row.onHand, row.stockStatus], ["1000", "6000", "OK"]);

  const card = await getItemStockCard(topStop.id, {});
  assert.deepEqual(card.lines.map((line) => [line.movementType, line.quantityIn, line.quantityOut, line.balance]), [
    ["GOODS_RECEIPT", "10000", null, "10000"],
    ["MATERIAL_ISSUE", null, "5000", "5000"],
    ["MATERIAL_RETURN", "1000", null, "6000"],
  ]);
  assert.deepEqual([card.openingBalance, card.totalIn, card.totalOut, card.closingBalance, card.closing.kg], ["0", "11000", "5000", "6000", "1.5"]);
  assert.deepEqual([card.received, card.issued, card.returned], ["10000", "5000", "1000"]);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const later = await getItemStockCard(topStop.id, { dateFrom: tomorrow });
  assert.deepEqual([later.openingBalance, later.lines.length, later.closingBalance], ["6000", 0, "6000"], "opening balance carries everything before the range");

  assert.equal((await stock({ search: product.sku })).items.length, 0, "finished products are not in the stock list");
  assert.equal((await stock({ search: product.sku, includeProducts: "true" })).items.length, 1, "unless asked for");
});

test("pieces and kg convert both ways from the unit weight", () => {
  assert.deepEqual(piecesAndKg("2", "Kgs", "0.5"), { pieces: "4000", kg: "2" });
  assert.deepEqual(piecesAndKg("300", "Pcs", null), { pieces: "300", kg: null });
  assert.deepEqual(piecesAndKg("12", "Meters", "3"), { pieces: null, kg: null });
});

test("a typed location is found or created; nothing has to be set up or activated first", async () => {
  assert.equal(locationCodeFor("Shelf 3 / Row 2"), "SHELF-3-ROW-2");
  const name = `Rack ${run} Row 2`;
  const created = await resolveTypedLocation(name, actor);
  const location = await db.orm.public.StorageLocation.where({ id: created }).first();
  assert.equal(location.code, locationCodeFor(name));
  assert.equal(location.name, name);
  assert.equal(location.status, "ACTIVE");

  assert.equal(await resolveTypedLocation(name.toLowerCase(), actor), created, "same name, any case: same location");
  assert.equal(await resolveTypedLocation(location.code, actor), created, "its code finds it too");

  await setLocationStatus(created, "INACTIVE", actor);
  assert.equal(await resolveTypedLocation(name, actor), created);
  assert.equal((await db.orm.public.StorageLocation.where({ id: created }).first()).status, "ACTIVE", "an inactive location is made active again");

  const [a, b] = await Promise.all([resolveTypedLocation(`Bin ${run}`, actor), resolveTypedLocation(`Bin ${run}`, actor)]);
  assert.equal(a, b, "two requests at once never make two locations");
});
