import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  agingBucket,
  creditLineAmounts,
  lineAmounts,
  outstandingAmount,
  paymentStatus,
  runningLedger,
  settleOldestFirst,
  sumAmounts,
} from "../../server/finance/finance-rules.ts";

test("line amounts are exact cents: gross, discount on gross, tax on the discounted amount", () => {
  assert.deepEqual(lineAmounts("3", "1.005", 0, 0), { grossAmount: "3.02", discountAmount: "0.00", taxAmount: "0.00", lineTotal: "3.02" });
  assert.deepEqual(lineAmounts("1000", "0.0375", 10, 17), { grossAmount: "37.50", discountAmount: "3.75", taxAmount: "5.74", lineTotal: "39.49" });
  assert.deepEqual(lineAmounts("0.333", "3", 0, 0).grossAmount, "1.00");
  assert.equal(lineAmounts("123456789.123456", "999.999999", 0, 0).grossAmount, "123456789000.00", "123456788999.99921… rounds half up");
});

test("totals add exactly", () => {
  const total = sumAmounts([lineAmounts("1", "0.10", 0, 0), lineAmounts("1", "0.20", 0, 0)]);
  assert.equal(total.lineTotal, "0.30");
  assert.equal(sumAmounts([]).lineTotal, "0.00");
});

test("partial credits never exceed the invoiced amounts; the last credit takes the exact remainder", () => {
  const line = { quantity: "3", unitPrice: "0.335", discountPercent: 0, taxPercent: 17, ...lineAmounts("3", "0.335", 0, 17) };
  assert.deepEqual([line.grossAmount, line.taxAmount, line.lineTotal], ["1.01", "0.17", "1.18"]);

  const none = { quantity: "0", grossAmount: "0.00", discountAmount: "0.00", taxAmount: "0.00", lineTotal: "0.00" };
  const first = creditLineAmounts(line, none, "1");
  assert.deepEqual(first, { grossAmount: "0.34", discountAmount: "0.00", taxAmount: "0.06", lineTotal: "0.40" });

  const afterOne = { quantity: "1", ...first };
  const second = creditLineAmounts(line, afterOne, "1");
  const afterTwo = { quantity: "2", ...sumAmounts([first, second]) };
  const last = creditLineAmounts(line, afterTwo, "1");
  assert.equal(sumAmounts([first, second, last]).lineTotal, line.lineTotal, "credits add up to the invoice line exactly");

  assert.equal(creditLineAmounts(line, afterTwo, "1.5"), null, "more than remains is refused");
  assert.equal(creditLineAmounts(line, none, "0"), null);
});

test("outstanding and payment status", () => {
  assert.equal(outstandingAmount("100.00", "10.00", "25.50"), "64.50");
  assert.equal(paymentStatus("100.00", "0", "0"), "UNPAID");
  assert.equal(paymentStatus("100.00", "0", "0.01"), "PARTIALLY_PAID");
  assert.equal(paymentStatus("100.00", "40.00", "60.00"), "PAID");
});

test("due dates and ageing buckets use calendar days", () => {
  assert.equal(addDays("2026-02-15", 30), "2026-03-17");
  assert.equal(addDays("2026-12-20", 15), "2027-01-04");
  assert.equal(agingBucket("2026-10-15", "2026-10-15"), "current");
  assert.equal(agingBucket("2026-10-14", "2026-10-15"), "1-30");
  assert.equal(agingBucket("2026-09-15", "2026-10-15"), "1-30");
  assert.equal(agingBucket("2026-09-14", "2026-10-15"), "31-60");
  assert.equal(agingBucket("2026-07-17", "2026-10-15"), "61-90", "90 days");
  assert.equal(agingBucket("2026-08-16", "2026-10-15"), "31-60", "60 days");
  assert.equal(agingBucket("2026-07-16", "2026-10-15"), "90+", "91 days");
  assert.throws(() => agingBucket("2026-02-30x", "2026-10-15"), RangeError);
});

test("customer ledger: running balance in date order, brought forward for a period (D-052)", () => {
  const item = (date, kind, debit, credit, at = "") => ({ date, kind, reference: kind, particulars: kind, debit, credit, at, sourceId: null });
  const items = [
    item("2026-10-10", "RECEIPT", "0", "2000"),
    item("2026-10-01", "INVOICE", "5000", "0"),
    item("2026-01-01", "OPENING", "1000.5", "0"),
    item("2026-10-10", "INVOICE", "300", "0"),
  ];
  const all = runningLedger(items);
  assert.deepEqual(all.rows.map((row) => [row.date, row.kind, row.balance]), [
    ["2026-01-01", "OPENING", "1000.50"],
    ["2026-10-01", "INVOICE", "6000.50"],
    ["2026-10-10", "INVOICE", "6300.50"],
    ["2026-10-10", "RECEIPT", "4300.50"],
  ]);
  assert.deepEqual([all.totalDebit, all.totalCredit, all.balance], ["6300.50", "2000.00", "4300.50"]);

  const period = runningLedger(items, "2026-10-05", "2026-10-31");
  assert.deepEqual(period.rows.map((row) => [row.particulars, row.debit, row.balance]), [
    ["Brought forward", "6000.50", "6000.50"],
    ["INVOICE", "300.00", "6300.50"],
    ["RECEIPT", "0.00", "4300.50"],
  ]);
  assert.equal(runningLedger(items, "", "2026-09-30").balance, "1000.50");
  assert.equal(runningLedger([item("2026-10-01", "RECEIPT", "0", "50")]).balance, "-50.00", "paid in advance");
});

test("payments on account settle the oldest dues first (D-052)", () => {
  const dues = [{ dueDate: "2026-11-01", outstanding: "500" }, { dueDate: "1900-01-01", outstanding: "300" }, { dueDate: "2026-10-01", outstanding: "200" }];
  assert.deepEqual(settleOldestFirst(dues, "400").map((due) => [due.dueDate, due.outstanding]), [["2026-10-01", "100.00"], ["2026-11-01", "500.00"]]);
  assert.deepEqual(settleOldestFirst(dues, "0").length, 3);
  assert.deepEqual(settleOldestFirst(dues, "5000"), []);
});
