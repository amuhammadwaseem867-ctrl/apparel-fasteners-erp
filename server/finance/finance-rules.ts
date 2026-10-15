/*
 * Invoicing rules that need no database (D-023). Inputs and outputs are
 * exact decimal strings; money is computed in whole cents with BigInt and
 * rounded half up at each step, exactly as sales order lines are (D-011).
 */

import {
  centsToDecimalString,
  compareDecimalStrings,
  decimalFromString,
  decimalSign,
  divideRoundHalfUp,
  subtractDecimalStrings,
} from "../core/utils/decimal";

export interface LineAmounts {
  grossAmount: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
}

const ZERO: LineAmounts = { grossAmount: "0.00", discountAmount: "0.00", taxAmount: "0.00", lineTotal: "0.00" };

function cents(amount: string): bigint {
  const { units, scale } = decimalFromString(amount);
  return divideRoundHalfUp(units * 100n, 10n ** BigInt(scale));
}

/* gross = qty × price (to the cent); discount on gross; tax on gross − discount. */
export function lineAmounts(quantity: string, unitPrice: string, discountPercent: number, taxPercent: number): LineAmounts {
  const q = decimalFromString(quantity);
  const p = decimalFromString(unitPrice);
  const gross = divideRoundHalfUp(q.units * p.units * 100n, 10n ** BigInt(q.scale + p.scale));
  const discount = divideRoundHalfUp(gross * BigInt(discountPercent), 100n);
  const tax = divideRoundHalfUp((gross - discount) * BigInt(taxPercent), 100n);
  return {
    grossAmount: centsToDecimalString(gross),
    discountAmount: centsToDecimalString(discount),
    taxAmount: centsToDecimalString(tax),
    lineTotal: centsToDecimalString(gross - discount + tax),
  };
}

export function sumAmounts(lines: LineAmounts[]): LineAmounts {
  const total = (field: keyof LineAmounts) => centsToDecimalString(lines.reduce((sum, line) => sum + cents(line[field]), 0n));
  return lines.length
    ? { grossAmount: total("grossAmount"), discountAmount: total("discountAmount"), taxAmount: total("taxAmount"), lineTotal: total("lineTotal") }
    : { ...ZERO };
}

function subtract(a: LineAmounts, b: LineAmounts): LineAmounts {
  const minus = (field: keyof LineAmounts) => centsToDecimalString(cents(a[field]) - cents(b[field]));
  return { grossAmount: minus("grossAmount"), discountAmount: minus("discountAmount"), taxAmount: minus("taxAmount"), lineTotal: minus("lineTotal") };
}

/*
 * Amounts for crediting `quantity` of an invoice line. A credit that
 * reaches the full invoiced quantity takes exactly what is left of each
 * amount, so rounding can never credit more than was invoiced. Returns
 * null when the quantity exceeds what is still creditable.
 */
export function creditLineAmounts(
  line: { quantity: string; unitPrice: string; discountPercent: number; taxPercent: number } & LineAmounts,
  alreadyCredited: { quantity: string } & LineAmounts,
  quantity: string,
): LineAmounts | null {
  const remainingQuantity = subtractDecimalStrings(line.quantity, alreadyCredited.quantity);
  if (decimalSign(quantity) <= 0 || compareDecimalStrings(quantity, remainingQuantity) > 0) return null;

  const remaining = subtract(line, alreadyCredited);
  if (compareDecimalStrings(quantity, remainingQuantity) === 0) return remaining;

  const computed = lineAmounts(quantity, line.unitPrice, line.discountPercent, line.taxPercent);
  // A partial credit can never take more than what is left of any amount.
  const cap = (field: keyof LineAmounts) => (cents(computed[field]) > cents(remaining[field]) ? remaining[field] : computed[field]);
  const gross = cap("grossAmount");
  const discount = cap("discountAmount");
  const tax = cap("taxAmount");
  return { grossAmount: gross, discountAmount: discount, taxAmount: tax, lineTotal: centsToDecimalString(cents(gross) - cents(discount) + cents(tax)) };
}

/* What the customer still owes: total − credit notes − posted receipts. */
export function outstandingAmount(total: string, credited: string, received: string): string {
  return centsToDecimalString(cents(total) - cents(credited) - cents(received));
}

export function paymentStatus(total: string, credited: string, received: string): "UNPAID" | "PARTIALLY_PAID" | "PAID" {
  const outstanding = cents(outstandingAmount(total, credited, received));
  if (outstanding <= 0n) return "PAID";
  return cents(received) > 0n || cents(credited) > 0n ? "PARTIALLY_PAID" : "UNPAID";
}

const DAY = 86400000;

function dayNumber(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(time)) throw new RangeError(`Invalid date ${date}`);
  return Math.floor(time / DAY);
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);
}

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;

/* Days past the due date, bucketed; not yet due is "current". */
export function agingBucket(dueDate: string, today: string): (typeof AGING_BUCKETS)[number] {
  const overdue = dayNumber(today) - dayNumber(dueDate);
  if (overdue <= 0) return "current";
  if (overdue <= 30) return "1-30";
  if (overdue <= 60) return "31-60";
  if (overdue <= 90) return "61-90";
  return "90+";
}

export function daysOverdue(dueDate: string, today: string): number {
  return Math.max(0, dayNumber(today) - dayNumber(dueDate));
}

/* A decimal string as money with exactly two decimals (half up). */
export function money(text: string): string {
  return centsToDecimalString(cents(text));
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const left = cents(a);
  const right = cents(b);
  return left === right ? 0 : left > right ? 1 : -1;
}

export function addMoney(a: string, b: string): string {
  return centsToDecimalString(cents(a) + cents(b));
}
