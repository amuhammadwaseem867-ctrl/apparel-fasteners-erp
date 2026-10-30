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

export function subtractMoney(a: string, b: string): string {
  return centsToDecimalString(cents(a) - cents(b));
}

/* ------------------------------------------------------------------ */
/* Customer ledger (D-052)                                             */
/* ------------------------------------------------------------------ */

/* OLD: a line of the customer's old Excel khata (D-057). */
export type LedgerKind = "OPENING" | "OLD" | "INVOICE" | "CREDIT_NOTE" | "RECEIPT";

export interface LedgerItem {
  date: string;
  kind: LedgerKind;
  reference: string;
  particulars: string;
  debit: string;
  credit: string;
  at: string;
  sourceId: string | null;
}

const KIND_ORDER: Record<LedgerKind, number> = { OPENING: 0, OLD: 1, INVOICE: 2, CREDIT_NOTE: 3, RECEIPT: 4 };

/*
 * The customer's ledger (khata), oldest first, with a running balance:
 * debit what they owe (old balance, invoices), credit what reduces it
 * (credit notes, payments). With `from`, everything earlier is one
 * "Brought forward" line; with `to`, later lines are left out.
 */
export function runningLedger(items: LedgerItem[], from = "", to = "") {
  const sorted = [...items]
    .filter((item) => !to || item.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.at.localeCompare(b.at));
  const before = from ? sorted.filter((item) => item.date < from) : [];
  const shown = from ? sorted.filter((item) => item.date >= from) : sorted;
  const rows: Array<LedgerItem & { balance: string }> = [];
  let balance = 0n;
  let debit = 0n;
  let credit = 0n;
  if (before.length) {
    const carried = before.reduce((sum, item) => sum + cents(item.debit) - cents(item.credit), 0n);
    const line = { debit: carried > 0n ? carried : 0n, credit: carried < 0n ? -carried : 0n };
    balance = carried;
    debit = line.debit;
    credit = line.credit;
    rows.push({ date: from, kind: "OPENING", reference: "", particulars: "Brought forward", debit: centsToDecimalString(line.debit), credit: centsToDecimalString(line.credit), at: "", sourceId: null, balance: centsToDecimalString(balance) });
  }
  for (const item of shown) {
    balance += cents(item.debit) - cents(item.credit);
    debit += cents(item.debit);
    credit += cents(item.credit);
    rows.push({ ...item, debit: money(item.debit), credit: money(item.credit), balance: centsToDecimalString(balance) });
  }
  return { rows, totalDebit: centsToDecimalString(debit), totalCredit: centsToDecimalString(credit), balance: centsToDecimalString(balance) };
}

/*
 * Payments on account (no invoice) settle the oldest dues first: the old
 * balance, then invoices by due date. Returns what is left on each due,
 * for aging; the total always equals the customer's ledger balance when
 * that is positive.
 */
export function settleOldestFirst<T extends { dueDate: string; outstanding: string }>(dues: T[], onAccount: string) {
  let left = cents(onAccount);
  return [...dues].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((due) => {
    const owed = cents(due.outstanding);
    const take = left > 0n ? (left < owed ? left : owed) : 0n;
    left -= take;
    return { ...due, outstanding: centsToDecimalString(owed - take) };
  }).filter((due) => cents(due.outstanding) > 0n);
}
