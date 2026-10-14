import assert from "node:assert/strict";
import test from "node:test";

import {
  centsToDecimalString,
  divideRoundHalfUp,
  multiplyToCents,
  toPlainDecimalString,
  toScaledDecimal,
} from "../../server/core/utils/decimal.ts";
import {
  calculateLineAmounts,
  salesOrderInputSchema,
} from "../../server/sales/sales.validation.ts";

test("decimal conversion is exact for typed values, including exponent notation", () => {
  assert.deepEqual(toScaledDecimal(1.005), { units: 1005n, scale: 3 });
  assert.deepEqual(toScaledDecimal(1e-7), { units: 1n, scale: 7 });
  assert.deepEqual(toScaledDecimal(2e21), { units: 2000000000000000000000n, scale: 0 });
  assert.equal(toPlainDecimalString(0.125), "0.125");
  assert.equal(toPlainDecimalString(1e-7), "0.0000001");
  assert.equal(toPlainDecimalString(1500), "1500");
  assert.throws(() => toScaledDecimal(Number.NaN), RangeError);
});

test("rounding is half up and never affected by binary floating point", () => {
  assert.equal(divideRoundHalfUp(5n, 10n), 1n);
  assert.equal(divideRoundHalfUp(4n, 10n), 0n);
  assert.equal(divideRoundHalfUp(-5n, 10n), -1n);

  // Float maths gives 301 and 100 here; the exact results are 302 and 101.
  assert.equal(multiplyToCents(3, 1.005), 302n);
  assert.equal(multiplyToCents(1, 1.005), 101n);
  assert.equal(multiplyToCents(7, 0.29), 203n);
  assert.equal(multiplyToCents(1.15, 100), 11500n);
  assert.equal(multiplyToCents(0.1, 3), 30n);
  assert.equal(multiplyToCents(1500.5, 0.125), 18756n);

  assert.equal(centsToDecimalString(302n), "3.02");
  assert.equal(centsToDecimalString(5n), "0.05");
  assert.equal(centsToDecimalString(0n), "0.00");
});

test("line amounts use exact gross, then discount, then tax on the discounted amount", () => {
  assert.deepEqual(
    calculateLineAmounts({ quantity: 3, unitPrice: 1.005, discountPercent: 0, taxPercent: 0 }),
    { grossCents: 302, discountCents: 0, taxCents: 0, totalCents: 302 },
  );

  assert.deepEqual(
    calculateLineAmounts({ quantity: 333, unitPrice: 0.335, discountPercent: 15, taxPercent: 17 }),
    // gross 111.555 -> 11156; discount 1673.4 -> 1673; tax (9483 * 0.17 = 1612.11) -> 1612
    { grossCents: 11156, discountCents: 1673, taxCents: 1612, totalCents: 11095 },
  );
});

test("orders whose amounts exceed the exact range are rejected by validation, not overflowed", () => {
  const base = {
    customerId: "00000000-0000-4000-8000-000000000001",
    orderDate: "2026-10-14",
  };
  const line = {
    kind: "custom",
    productName: "Large line",
    unit: "Pcs",
    discountPercent: 0,
    taxPercent: 0,
  };

  const tooLarge = salesOrderInputSchema.safeParse({
    ...base,
    lines: [{ ...line, quantity: 100000000, unitPrice: 100000000 }],
  });
  assert.equal(tooLarge.success, false);
  assert.ok(tooLarge.error.issues.some((issue) => /too large/.test(issue.message)));

  const fine = salesOrderInputSchema.safeParse({
    ...base,
    lines: [{ ...line, quantity: 250000, unitPrice: 0.0375 }],
  });
  assert.equal(fine.success, true);

  assert.throws(
    () => calculateLineAmounts({ quantity: 100000000, unitPrice: 100000000, discountPercent: 0, taxPercent: 0 }),
    RangeError,
  );
});

test("unit prices keep sub-cent precision up to six decimal places and reject more", () => {
  const order = (unitPrice) => salesOrderInputSchema.safeParse({
    customerId: "00000000-0000-4000-8000-000000000001",
    orderDate: "2026-10-14",
    lines: [{ kind: "custom", productName: "Slider", unit: "Pcs", quantity: 1000, unitPrice, discountPercent: 0, taxPercent: 0 }],
  });

  assert.equal(order(0.125).success, true);
  assert.equal(order(0.035125).success, true);

  const tooPrecise = order(0.0351251);
  assert.equal(tooPrecise.success, false);
  assert.ok(tooPrecise.error.issues.some((issue) => /at most 6 decimal places/.test(issue.message)));
});
