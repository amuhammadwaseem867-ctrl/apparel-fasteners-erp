import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { db } from "../../server/core/database/client.ts";
import {
  createLocation,
  createReservation,
  createWarehouse,
  getStockSummary,
  listBalances,
  postStockDocument,
  releaseReservation,
  setWarehouseStatus,
} from "../../server/inventory/inventory.service.ts";
import { stockDocumentInputSchema } from "../../server/inventory/inventory.validation.ts";
import {
  changeSalesOrderStatus,
  createCustomer,
  createSalesOrder,
  updateSalesOrder,
} from "../../server/sales/sales.service.ts";
import {
  archiveProduct,
  createProduct,
  deleteProductPermanently,
} from "../../server/products/product.service.ts";

const run = Date.now().toString(36).toUpperCase();
const actor = randomUUID();

let warehouse;
let locA;
let locB;
let pcs;
let meters;

async function product(sku, unit) {
  return createProduct({
    sku: `${sku}-${run}`,
    name: `Test ${sku}`,
    category: "Test",
    productType: "Component",
    unit,
    unitPrice: 1,
    status: "ACTIVE",
    minimumStock: 0,
  }, actor);
}

function post(documentType, lines, extra = {}) {
  const parsed = stockDocumentInputSchema.parse({
    documentType,
    idempotencyKey: randomUUID(),
    reason: "integration test",
    lines,
    ...extra,
  });
  return postStockDocument(parsed, actor);
}

async function balance(productId, locationId) {
  const row = await db.orm.public.StockBalance.where({ productId, locationId }).first();
  return row
    ? { onHand: Number(row.onHand), reserved: Number(row.reserved), qualityHold: Number(row.qualityHold) }
    : { onHand: 0, reserved: 0, qualityHold: 0 };
}

/* The ledger must always explain the balance exactly. */
async function assertLedgerMatches(productId, locationId) {
  const movements = await db.orm.public.StockMovement.where({ productId, locationId }).all();
  const sum = (bucket) => movements
    .filter((movement) => movement.bucket === bucket)
    .reduce((total, movement) => total + Number(movement.quantityDelta), 0);
  const current = await balance(productId, locationId);

  assert.equal(sum("ON_HAND"), current.onHand, "ledger ON_HAND sum matches balance");
  assert.equal(sum("RESERVED"), current.reserved, "ledger RESERVED sum matches balance");
  assert.equal(sum("QUALITY_HOLD"), current.qualityHold, "ledger QUALITY_HOLD sum matches balance");
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

test.before(async () => {
  warehouse = await createWarehouse({ code: `WH-${run}`, name: "Test warehouse", warehouseType: "RAW_MATERIAL" }, actor);
  locA = await createLocation({ warehouseId: warehouse.id, code: "A1", name: "Aisle 1" }, actor);
  locB = await createLocation({ warehouseId: warehouse.id, code: "B1", name: "Bay 1" }, actor);
  pcs = await product("SLD", "Pcs");
  meters = await product("TAPE", "Meters");
});

test("goods receipt adds stock, numbers the document and writes the ledger", async () => {
  const { document, replayed } = await post("GOODS_RECEIPT", [{ productId: pcs.id, locationId: locA.id, quantity: 100 }]);

  assert.equal(replayed, false);
  assert.match(document.documentNumber, /^GRN-\d{4}-\d{6}$/);
  assert.equal(document.movements.length, 1);
  assert.equal(document.movements[0].quantityDelta, "100");
  assert.equal(document.movements[0].balanceAfter, "100");
  assert.deepEqual(await balance(pcs.id, locA.id), { onHand: 100, reserved: 0, qualityHold: 0 });

  const audit = await db.orm.public.AuditLog.where({ entityId: document.id, action: "STOCK_DOCUMENT_POSTED" }).first();
  assert.ok(audit, "audit event written with the document");
});

test("repeating a submission returns the original document and posts nothing", async () => {
  const input = stockDocumentInputSchema.parse({
    documentType: "GOODS_RECEIPT",
    idempotencyKey: randomUUID(),
    lines: [{ productId: meters.id, locationId: locA.id, quantity: 12.5 }],
  });

  const first = await postStockDocument(input, actor);
  const second = await postStockDocument(input, actor);

  assert.equal(second.replayed, true);
  assert.equal(second.document.id, first.document.id);
  assert.equal((await balance(meters.id, locA.id)).onHand, 12.5);

  await expectCode(
    postStockDocument({ ...input, documentType: "STOCK_IN", reason: "x" }, actor),
    "IDEMPOTENCY_KEY_REUSED",
  );
});

test("concurrent duplicate submissions create exactly one document", async () => {
  const input = stockDocumentInputSchema.parse({
    documentType: "GOODS_RECEIPT",
    idempotencyKey: randomUUID(),
    lines: [{ productId: meters.id, locationId: locB.id, quantity: 5 }],
  });

  const results = await Promise.all([1, 2, 3, 4].map(() => postStockDocument(input, actor)));
  const ids = new Set(results.map((result) => result.document.id));

  assert.equal(ids.size, 1);
  assert.equal((await balance(meters.id, locB.id)).onHand, 5);
  await assertLedgerMatches(meters.id, locB.id);
});

test("an issue larger than available stock is refused and changes nothing", async () => {
  const before = await db.orm.public.StockDocument.where({ documentType: "MATERIAL_ISSUE" }).all();

  await expectCode(post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locA.id, quantity: 150 }]), "INSUFFICIENT_STOCK");

  const after = await db.orm.public.StockDocument.where({ documentType: "MATERIAL_ISSUE" }).all();
  assert.equal(after.length, before.length, "no document left behind");
  assert.equal((await balance(pcs.id, locA.id)).onHand, 100);
});

test("issue and transfer move stock and keep the ledger consistent", async () => {
  await post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locA.id, quantity: 30 }]);
  const transfer = await post("TRANSFER", [{ productId: pcs.id, locationId: locA.id, toLocationId: locB.id, quantity: 20 }]);

  assert.equal(transfer.document.movements.length, 2);
  assert.equal((await balance(pcs.id, locA.id)).onHand, 50);
  assert.equal((await balance(pcs.id, locB.id)).onHand, 20);
  await assertLedgerMatches(pcs.id, locA.id);
  await assertLedgerMatches(pcs.id, locB.id);
});

test("reserved stock is not available, and an issue can consume a reservation", async () => {
  const { reservation } = await createReservation({
    idempotencyKey: randomUUID(),
    productId: pcs.id,
    locationId: locA.id,
    quantity: 40,
  }, actor);

  assert.deepEqual(await balance(pcs.id, locA.id), { onHand: 50, reserved: 40, qualityHold: 0 });

  // Only 10 are free; an unreserved issue of 20 must fail.
  await expectCode(post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locA.id, quantity: 20 }]), "INSUFFICIENT_STOCK");

  await post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locA.id, quantity: 25, reservationId: reservation.id }]);
  assert.deepEqual(await balance(pcs.id, locA.id), { onHand: 25, reserved: 15, qualityHold: 0 });

  // Consuming more than is open on the reservation is refused.
  await expectCode(
    post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locA.id, quantity: 16, reservationId: reservation.id }]),
    "RESERVATION_UNAVAILABLE",
  );

  const released = await releaseReservation(reservation.id, { idempotencyKey: randomUUID() }, actor);
  assert.equal(released.reservation.status, "RELEASED");
  assert.equal(released.reservation.consumedQuantity, "25");
  assert.equal(released.reservation.releasedQuantity, "15");
  assert.deepEqual(await balance(pcs.id, locA.id), { onHand: 25, reserved: 0, qualityHold: 0 });

  await expectCode(releaseReservation(reservation.id, { idempotencyKey: randomUUID() }, actor), "RESERVATION_NOT_ACTIVE");
  await assertLedgerMatches(pcs.id, locA.id);
});

test("quality hold blocks stock until released or rejected", async () => {
  await post("QC_HOLD", [{ productId: pcs.id, locationId: locA.id, quantity: 10 }]);
  await expectCode(post("STOCK_OUT", [{ productId: pcs.id, locationId: locA.id, quantity: 20 }]), "INSUFFICIENT_STOCK");

  await post("QC_RELEASE", [{ productId: pcs.id, locationId: locA.id, quantity: 4 }]);
  await post("QC_REJECT", [{ productId: pcs.id, locationId: locA.id, quantity: 6 }]);

  assert.deepEqual(await balance(pcs.id, locA.id), { onHand: 19, reserved: 0, qualityHold: 0 });
  await expectCode(post("QC_RELEASE", [{ productId: pcs.id, locationId: locA.id, quantity: 1 }]), "INSUFFICIENT_STOCK");
  await assertLedgerMatches(pcs.id, locA.id);
});

test("physical count posts only the difference, and adjustments respect available stock", async () => {
  const counted = await post("COUNT", [{ productId: pcs.id, locationId: locA.id, quantity: 21 }]);
  assert.equal(counted.document.movements.length, 1);
  assert.equal(counted.document.movements[0].quantityDelta, "2");

  const unchanged = await post("COUNT", [{ productId: pcs.id, locationId: locA.id, quantity: 21 }]);
  assert.equal(unchanged.document.movements.length, 0, "a matching count posts no movement");

  await post("ADJUSTMENT", [{ productId: pcs.id, locationId: locA.id, quantity: -1 }]);
  await expectCode(post("ADJUSTMENT", [{ productId: pcs.id, locationId: locA.id, quantity: -100 }]), "INSUFFICIENT_STOCK");
  assert.equal((await balance(pcs.id, locA.id)).onHand, 20);
  await assertLedgerMatches(pcs.id, locA.id);
});

test("quantities must respect the item's unit of measure", async () => {
  await expectCode(post("GOODS_RECEIPT", [{ productId: pcs.id, locationId: locA.id, quantity: 1.5 }]), "QUANTITY_PRECISION");
  await post("GOODS_RECEIPT", [{ productId: meters.id, locationId: locA.id, quantity: 1.25 }]);
  await expectCode(post("GOODS_RECEIPT", [{ productId: meters.id, locationId: locA.id, quantity: 1.2345 }]), "QUANTITY_PRECISION");
});

test("concurrent issues never take stock below zero", async () => {
  // locB holds 20 pieces. Five concurrent issues of 6: at most three fit.
  const results = await Promise.allSettled(
    [1, 2, 3, 4, 5].map(() => post("MATERIAL_ISSUE", [{ productId: pcs.id, locationId: locB.id, quantity: 6 }])),
  );
  const succeeded = results.filter((result) => result.status === "fulfilled").length;
  const refused = results.filter((result) => result.status === "rejected");

  assert.equal(succeeded, 3);
  for (const result of refused) {
    assert.equal(result.reason.code, "INSUFFICIENT_STOCK");
  }
  assert.equal((await balance(pcs.id, locB.id)).onHand, 2);
  await assertLedgerMatches(pcs.id, locB.id);
});

test("summary reports per-unit totals and low-stock alerts from real balances", async () => {
  await db.orm.public.Product.where({ id: pcs.id }).update({ minimumStock: "50" });
  const summary = await getStockSummary();
  const alert = summary.alerts.find((item) => item.productId === pcs.id);

  assert.ok(alert, "item below its minimum appears as an alert");
  assert.equal(alert.lowStock, true);
  // Summary is per item across all locations: 20 at A1 + 2 at B1.
  assert.equal(alert.available, "22");
  assert.ok(summary.totalsByUnit.every((total) => typeof total.unit === "string"));

  const page = await listBalances({ productId: pcs.id, search: "", page: 1, pageSize: 25 });
  assert.equal(page.balances.length, 2);
  assert.ok(page.balances.every((row) => row.sku === pcs.sku && row.warehouseCode === warehouse.code));
});

test("history-bearing master data is protected", async () => {
  await expectCode(setWarehouseStatus(warehouse.id, "ARCHIVED", actor), "WAREHOUSE_HAS_STOCK");

  await archiveProduct(pcs.id, actor);
  await expectCode(post("GOODS_RECEIPT", [{ productId: pcs.id, locationId: locA.id, quantity: 1 }]), "PRODUCT_ARCHIVED");
  await expectCode(deleteProductPermanently(pcs.id, actor), "PRODUCT_HAS_HISTORY");

  const unused = await product("UNUSED", "Pcs");
  await expectCode(deleteProductPermanently(unused.id, actor), "PRODUCT_NOT_ARCHIVED");
  await archiveProduct(unused.id, actor);
  assert.deepEqual(await deleteProductPermanently(unused.id, actor), { id: unused.id, deleted: true });
});

test("cancelling a sales order releases its reservations; concurrent status changes have one winner", async () => {
  const item = await product("ORD", "Pcs");
  await post("GOODS_RECEIPT", [{ productId: item.id, locationId: locA.id, quantity: 10 }]);

  const customer = await createCustomer({ code: `C-${run}`, name: "Test customer" }, actor);
  const order = await createSalesOrder({
    customerId: customer.id,
    orderDate: "2026-10-14",
    lines: [{ kind: "catalog", productId: item.id, quantity: 4, unitPrice: 2, discountPercent: 0, taxPercent: 0 }],
  }, actor);

  const { reservation } = await createReservation({
    idempotencyKey: randomUUID(),
    productId: item.id,
    locationId: locA.id,
    quantity: 4,
    salesOrderId: order.id,
    salesOrderLineId: order.lines[0].id,
  }, actor);
  assert.equal((await balance(item.id, locA.id)).reserved, 4);

  const outcomes = await Promise.allSettled([
    changeSalesOrderStatus(order.id, "approve", actor),
    changeSalesOrderStatus(order.id, "cancel", actor),
  ]);
  const winners = outcomes.filter((outcome) => outcome.status === "fulfilled");
  assert.ok(winners.length >= 1);

  // Whatever won first, a cancel must leave no stock reserved.
  const final = await db.orm.public.SalesOrder.where({ id: order.id }).first();
  if (final.status !== "CANCELLED") {
    await changeSalesOrderStatus(order.id, "cancel", actor);
  }

  const released = await db.orm.public.StockReservation.where({ id: reservation.id }).first();
  assert.equal(released.status, "RELEASED");
  assert.equal((await balance(item.id, locA.id)).reserved, 0);
  await assertLedgerMatches(item.id, locA.id);

  await expectCode(createReservation({
    idempotencyKey: randomUUID(),
    productId: item.id,
    locationId: locA.id,
    quantity: 1,
    salesOrderId: order.id,
  }, actor), "SALES_ORDER_CANCELLED");
});

test("two concurrent identical status changes: exactly one succeeds", async () => {
  const customer = await createCustomer({ code: `C2-${run}`, name: "Race customer" }, actor);
  const order = await createSalesOrder({
    customerId: customer.id,
    orderDate: "2026-10-14",
    lines: [{ kind: "custom", productName: "Race", unit: "Pcs", quantity: 1, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  }, actor);

  const outcomes = await Promise.allSettled([1, 2, 3].map(() => changeSalesOrderStatus(order.id, "approve", actor)));
  const succeeded = outcomes.filter((outcome) => outcome.status === "fulfilled");

  assert.equal(succeeded.length, 1);
  for (const outcome of outcomes.filter((entry) => entry.status === "rejected")) {
    assert.equal(outcome.reason.code, "SALES_ORDER_STATUS_CONFLICT");
  }
});

test("a draft order with line reservations cannot have its lines replaced", async () => {
  const item = await product("EDT", "Pcs");
  await post("GOODS_RECEIPT", [{ productId: item.id, locationId: locA.id, quantity: 5 }]);
  const customer = await createCustomer({ code: `C3-${run}`, name: "Edit customer" }, actor);
  const input = {
    customerId: customer.id,
    orderDate: "2026-10-14",
    lines: [{ kind: "catalog", productId: item.id, quantity: 2, unitPrice: 1, discountPercent: 0, taxPercent: 0 }],
  };
  const order = await createSalesOrder(input, actor);
  const { reservation } = await createReservation({
    idempotencyKey: randomUUID(),
    productId: item.id,
    locationId: locA.id,
    quantity: 2,
    salesOrderId: order.id,
    salesOrderLineId: order.lines[0].id,
  }, actor);

  await expectCode(updateSalesOrder(order.id, input, actor), "SALES_ORDER_HAS_RESERVATIONS");

  await releaseReservation(reservation.id, { idempotencyKey: randomUUID() }, actor);
  const edited = await updateSalesOrder(order.id, { ...input, notes: "edited" }, actor);
  assert.equal(edited.notes, "edited");
});
