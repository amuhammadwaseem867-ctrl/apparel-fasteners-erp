/*
 * Double-entry rules that need no database (D-030). Amounts are decimal
 * strings handled in whole cents with BigInt.
 */

import { centsToDecimalString, decimalFromString, divideRoundHalfUp } from "../core/utils/decimal";

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export interface EntryLine {
  debit: string;
  credit: string;
}

export function cents(amount: string): bigint {
  const { units, scale } = decimalFromString(amount || "0");
  return divideRoundHalfUp(units * 100n, 10n ** BigInt(scale));
}

export const fromCents = centsToDecimalString;

/* Assets and expenses grow with debits; the rest grow with credits. */
export function debitNormal(type: AccountType): boolean {
  return type === "ASSET" || type === "EXPENSE";
}

/* Balance in the account's normal direction (positive = normal). */
export function normalBalance(type: AccountType, debit: string, credit: string): string {
  const difference = cents(debit) - cents(credit);
  return fromCents(debitNormal(type) ? difference : -difference);
}

/*
 * Returns why a set of lines is not a valid journal entry, or null.
 * Every line has exactly one positive side in whole cents; debits equal
 * credits; there are at least two lines.
 */
export function entryProblem(lines: EntryLine[]): string | null {
  if (lines.length < 2) return "A journal entry needs at least two lines.";
  let debits = 0n;
  let credits = 0n;
  for (const [index, line] of lines.entries()) {
    const debit = decimalFromString(line.debit || "0");
    const credit = decimalFromString(line.credit || "0");
    if (debit.scale > 2 && cents(line.debit) * 10n ** BigInt(debit.scale - 2) !== debit.units) return `Line ${index + 1}: amounts are in whole cents.`;
    if (credit.scale > 2 && cents(line.credit) * 10n ** BigInt(credit.scale - 2) !== credit.units) return `Line ${index + 1}: amounts are in whole cents.`;
    const d = cents(line.debit);
    const c = cents(line.credit);
    if (d < 0n || c < 0n) return `Line ${index + 1}: amounts cannot be negative.`;
    if ((d === 0n) === (c === 0n)) return `Line ${index + 1}: enter either a debit or a credit.`;
    debits += d;
    credits += c;
  }
  if (debits !== credits) return `Debits (${fromCents(debits)}) must equal credits (${fromCents(credits)}).`;
  return null;
}

export function entryTotal(lines: EntryLine[]): string {
  return fromCents(lines.reduce((sum, line) => sum + cents(line.debit), 0n));
}

/* Swaps sides: the reversal of an entry. */
export function reverseLines<T extends EntryLine>(lines: T[]): T[] {
  return lines.map((line) => ({ ...line, debit: line.credit, credit: line.debit }));
}

/* Drops zero lines from an automatic posting and keeps the rest. */
export function nonZero<T extends EntryLine>(lines: T[]): T[] {
  return lines.filter((line) => cents(line.debit) !== 0n || cents(line.credit) !== 0n);
}
