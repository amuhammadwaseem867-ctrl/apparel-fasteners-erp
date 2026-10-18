import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { COMPANY } from "../../config/company.js";
import {
  formatAmount,
  formatQuantity,
  toSalesOrderSheet,
} from "../../lib/print/salesOrderSheet.js";

const order = {
  orderNumber: "SO-1",
  status: "APPROVED",
  orderDate: "2026-10-01",
  deliveryDate: null,
  notes: "",
  customer: { name: "Customer A", code: "C-A", phone: null, email: "a@x.test" },
  lines: [
    { id: "l1", productName: "Item", isCustom: false, skuReference: null, quantity: 1500.5, unit: "Pcs", unitPrice: 0.125, discountPercent: 5, taxPercent: 0, lineTotal: 178.18 },
  ],
  subtotal: 187.56,
  discountTotal: 9.38,
  taxTotal: 0,
  totalAmount: 178.18,
};

test("document title reflects the order status so a draft never reads as a confirmation", () => {
  assert.equal(toSalesOrderSheet(order).title, "Order Confirmation");
  assert.equal(toSalesOrderSheet(order).isFinal, true);
  assert.equal(toSalesOrderSheet({ ...order, status: "DRAFT" }).title, "Sales Order (Draft)");
  assert.equal(toSalesOrderSheet({ ...order, status: "DRAFT" }).isFinal, false);
  assert.equal(toSalesOrderSheet({ ...order, status: "CANCELLED" }).title, "Sales Order (Cancelled)");
});

test("printed totals are the server values, not recomputed in the browser", () => {
  const sheet = toSalesOrderSheet(order);

  assert.deepEqual(sheet.totals, {
    subtotal: "187.56",
    discount: "9.38",
    tax: "0.00",
    total: "178.18",
  });
  assert.equal(sheet.lines[0].lineTotal, "178.18");
  assert.equal(sheet.lines[0].quantity, "1,500.5");
  assert.equal(sheet.lines[0].unitPrice, "0.125", "sub-cent unit prices keep their stored precision");
  assert.equal(sheet.lines[0].discount, "5%");
});

test("missing optional fields print as explicit placeholders, never invented values", () => {
  const sheet = toSalesOrderSheet(order);

  assert.equal(sheet.deliveryDate, "Not set");
  assert.equal(sheet.notes, null);
  assert.equal(sheet.customer.phone, null);
  assert.equal(sheet.customer.email, "a@x.test");
  assert.equal(sheet.lines[0].sku, "—");
  assert.equal(formatAmount("not a number"), "—");
  assert.equal(formatQuantity(undefined), "—");
});

test("company identity holds only what the AF7 company documents show; other details are not invented", () => {
  assert.equal(COMPANY.name, "AF7");
  assert.match(COMPANY.address, /^Plot# 33 B Punjab Small Sundar Industrial Estate II/);
  assert.equal(COMPANY.website, "www.af7.com.pk");

  for (const field of ["phone", "email", "taxRegistration", "bankName", "accountName", "accountNumber", "iban", "swiftCode", "bankBranch", "productionTime", "paymentTerms", "shipmentTerms", "shipmentMode", "portOfLoading"]) {
    assert.equal(COMPANY[field], "", `${field} must stay empty until the owner supplies it`);
  }
});

test("print routes require a session and load data through the permission-checked API", () => {
  const root = join(import.meta.dirname, "../..");
  const layout = readFileSync(join(root, "app/print/layout.jsx"), "utf8");
  const client = readFileSync(join(root, "app/print/sales-orders/[id]/SalesOrderSheetClient.jsx"), "utf8");

  assert.match(layout, /getCurrentUser\(sessionToken\)/);
  assert.match(layout, /redirect\("\/login"\)/);
  assert.match(client, /useApiData\(`\/api\/sales\/orders\//);
});
