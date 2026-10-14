/*
 * Exact decimal arithmetic for money and quantities.
 *
 * Values arrive as JavaScript numbers (JSON). Each is converted through its
 * shortest round-trip decimal string, which is exactly what the user typed,
 * into a scaled BigInt, so products and rounding are exact. Floating-point
 * multiplication is never used for amounts.
 */

export interface ScaledDecimal {
  units: bigint;
  scale: number;
}

export function toScaledDecimal(value: number): ScaledDecimal {
  if (!Number.isFinite(value)) {
    throw new RangeError("Decimal value must be finite.");
  }

  const [mantissa, exponentText] = String(value).toLowerCase().split("e");
  const exponent = exponentText ? Number(exponentText) : 0;
  const negative = mantissa.startsWith("-");
  const [whole, fraction = ""] = mantissa.replace("-", "").split(".");

  let digits = `${whole}${fraction}`;
  let scale = fraction.length - exponent;

  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }

  const units = BigInt(digits) * (negative ? -1n : 1n);

  return { units, scale };
}

export function toPlainDecimalString(value: number): string {
  const { units, scale } = toScaledDecimal(value);
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = scale ? `.${digits.slice(digits.length - scale)}` : "";

  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/* Integer division rounding half away from zero. */
export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError("Denominator must be positive.");
  }

  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute * 2n + denominator) / (denominator * 2n);

  return negative ? -rounded : rounded;
}

/* quantity × unitPrice expressed in whole cents, rounded half up. */
export function multiplyToCents(quantity: number, unitPrice: number): bigint {
  const q = toScaledDecimal(quantity);
  const p = toScaledDecimal(unitPrice);

  return divideRoundHalfUp(q.units * p.units * 100n, 10n ** BigInt(q.scale + p.scale));
}

export function centsToDecimalString(cents: bigint): string {
  const negative = cents < 0n;
  const digits = (negative ? -cents : cents).toString().padStart(3, "0");

  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
