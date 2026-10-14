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

/* Parses an exact decimal string as PostgreSQL returns numeric values. */
export function decimalFromString(text: string): ScaledDecimal {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text.trim());

  if (!match) {
    throw new RangeError(`Not a decimal string: ${text}`);
  }

  const [, sign, whole, fraction = ""] = match;
  const units = BigInt(`${whole}${fraction}`) * (sign ? -1n : 1n);

  return { units, scale: fraction.length };
}

function alignScales(a: ScaledDecimal, b: ScaledDecimal) {
  const scale = Math.max(a.scale, b.scale);

  return {
    a: a.units * 10n ** BigInt(scale - a.scale),
    b: b.units * 10n ** BigInt(scale - b.scale),
    scale,
  };
}

export function scaledToPlainString({ units, scale }: ScaledDecimal): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  let fraction = scale ? digits.slice(digits.length - scale) : "";

  fraction = fraction.replace(/0+$/, "");

  return `${negative && (whole !== "0" || fraction) ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/* a - b for decimal strings, exact. */
export function subtractDecimalStrings(a: string, b: string): string {
  const aligned = alignScales(decimalFromString(a), decimalFromString(b));

  return scaledToPlainString({ units: aligned.a - aligned.b, scale: aligned.scale });
}

/* Sign of a decimal string: -1, 0 or 1. */
export function decimalSign(text: string): -1 | 0 | 1 {
  const { units } = decimalFromString(text);

  return units === 0n ? 0 : units < 0n ? -1 : 1;
}

/* Normalises a decimal string (drops trailing zeros: "5.000" -> "5"). */
export function normalizeDecimalString(text: string): string {
  return scaledToPlainString(decimalFromString(text));
}

/* a + b for decimal strings, exact. */
export function addDecimalStrings(a: string, b: string): string {
  const aligned = alignScales(decimalFromString(a), decimalFromString(b));

  return scaledToPlainString({ units: aligned.a + aligned.b, scale: aligned.scale });
}

/* a × b for decimal strings, exact (scales add). */
export function multiplyDecimalStrings(a: string, b: string): string {
  const x = decimalFromString(a);
  const y = decimalFromString(b);

  return scaledToPlainString({ units: x.units * y.units, scale: x.scale + y.scale });
}

/* -1, 0 or 1 as a < b, a = b, a > b. */
export function compareDecimalStrings(a: string, b: string): -1 | 0 | 1 {
  return decimalSign(subtractDecimalStrings(a, b));
}

/*
 * Rounds a non-negative decimal string UP to `scale` decimal places
 * (planned quantities: 2.1 pieces must be planned as 3).
 */
export function ceilDecimalString(text: string, scale: number): string {
  const value = decimalFromString(text);

  if (value.units < 0n) {
    throw new RangeError("ceilDecimalString expects a non-negative value.");
  }

  if (value.scale <= scale) {
    return scaledToPlainString(value);
  }

  const divisor = 10n ** BigInt(value.scale - scale);
  const whole = value.units / divisor;
  const units = value.units % divisor === 0n ? whole : whole + 1n;

  return scaledToPlainString({ units, scale });
}
