import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  agingBucket,
  creditLineAmounts,
  lineAmounts,
  outstandingAmount,
  paymentStatus,
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
