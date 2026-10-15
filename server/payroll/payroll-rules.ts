/*
 * Payroll calculation without a database (D-027). Money is computed in
 * whole cents with BigInt and rounded half up; inputs and outputs are
 * exact decimal strings. No tax or statutory rate is built in: the fixed
 * deduction is whatever the owner sets per employee.
 *
 *   employed days  calendar days of the month within the employment dates
 *   MONTHLY        paid days = employed − absent − unpaid leave − ½ × half days
 *                  (days without a record are paid and reported as unrecorded)
 *   DAILY          paid days = present + paid leave + ½ × half days
 *                  (only recorded work is paid)
 *   basic earned   MONTHLY basic × paid / days in month; DAILY rate × paid days
 *   allowances     monthly allowances × paid / days in month
 *   overtime       hours × hourly rate
 *   deductions     fixed deduction, then advance instalments (oldest first),
 *                  each limited so net pay is never negative
 */

import { centsToDecimalString, decimalFromString, divideRoundHalfUp } from "../core/utils/decimal";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "PAID_LEAVE" | "UNPAID_LEAVE" | "HOLIDAY" | "WEEKLY_OFF";

const DAY = 86400000;

function dayNumber(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
}

export function periodBounds(period: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new RangeError(`Invalid payroll period ${period}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(days).padStart(2, "0")}`, days };
}

/* Days of the period that fall inside the employment dates (inclusive). */
export function employedDays(period: string, joinDate: string, leftDate: string | null) {
  const { start, end } = periodBounds(period);
  const from = Math.max(dayNumber(start), dayNumber(joinDate));
  const to = Math.min(dayNumber(end), leftDate ? dayNumber(leftDate) : dayNumber(end));
  return Math.max(0, to - from + 1);
}

export function isEmployedOn(date: string, joinDate: string, leftDate: string | null) {
  return date >= joinDate && (!leftDate || date <= leftDate);
}

/* Scaled helpers on decimal strings, all rounded half up to the cent. */
function scaled(text: string) {
  return decimalFromString(text);
}

function cents(text: string) {
  const { units, scale } = scaled(text);
  return divideRoundHalfUp(units * 100n, 10n ** BigInt(scale));
}

/* amount × numerator / denominator, in cents. */
function prorate(amount: string, numerator: string, denominator: number) {
  const a = scaled(amount);
  const n = scaled(numerator);
  return divideRoundHalfUp(a.units * n.units * 100n, 10n ** BigInt(a.scale + n.scale) * BigInt(denominator));
}

function times(a: string, b: string) {
  const x = scaled(a);
  const y = scaled(b);
  return divideRoundHalfUp(x.units * y.units * 100n, 10n ** BigInt(x.scale + y.scale));
}

/* Half days make paid days a multiple of 0.5; keep one decimal. */
function halves(count: number) {
  return count % 2 === 0 ? String(count / 2) : `${(count - 1) / 2}.5`;
}

export interface PayrollEmployee {
  payBasis: "MONTHLY" | "DAILY";
  joinDate: string;
  leftDate: string | null;
  basicSalary: string;
  allowances: string;
  overtimeRate: string;
  fixedDeduction: string;
}

export interface OpenAdvance {
  id: string;
  remaining: string;
  installment: string;
}

export function calculatePayrollLine(
  period: string,
  employee: PayrollEmployee,
  records: Array<{ date: string; status: AttendanceStatus; overtimeHours: string }>,
  advances: OpenAdvance[],
) {
  const { days: periodDays } = periodBounds(period);
  const employed = employedDays(period, employee.joinDate, employee.leftDate);
  const inEmployment = records.filter((record) => isEmployedOn(record.date, employee.joinDate, employee.leftDate));
  const count = (status: AttendanceStatus) => inEmployment.filter((record) => record.status === status).length;

  const present = count("PRESENT");
  const halfDays = count("HALF_DAY");
  const paidLeave = count("PAID_LEAVE");
  const absent = count("ABSENT");
  const unpaidLeave = count("UNPAID_LEAVE");
  const unrecorded = Math.max(0, employed - inEmployment.length);

  // Paid days in half-day units, so they stay exact.
  const paidHalves = employee.payBasis === "MONTHLY"
    ? 2 * employed - 2 * absent - 2 * unpaidLeave - halfDays
    : 2 * present + 2 * paidLeave + halfDays;
  const paidDays = halves(Math.max(0, paidHalves));
  const unpaidDays = halves(Math.max(0, 2 * employed - Math.max(0, paidHalves)));

  const basicEarned = employee.payBasis === "MONTHLY"
    ? prorate(employee.basicSalary, paidDays, periodDays)
    : times(employee.basicSalary, paidDays);
  const allowancesEarned = prorate(employee.allowances, paidDays, periodDays);
  const overtimeHours = inEmployment.reduce((sum, record) => sum + scaledHundredths(record.overtimeHours), 0n);
  const overtimeHoursText = centsToDecimalString(overtimeHours);
  const overtimePay = times(overtimeHoursText, employee.overtimeRate);
  const gross = basicEarned + allowancesEarned + overtimePay;

  const fixed = minBig(cents(employee.fixedDeduction), gross);
  let room = gross - fixed;
  const recoveries: Array<{ advanceId: string; amount: string }> = [];
  for (const advance of advances) {
    if (room <= 0n) break;
    const take = minBig(minBig(cents(advance.installment), cents(advance.remaining)), room);
    if (take > 0n) {
      recoveries.push({ advanceId: advance.id, amount: centsToDecimalString(take) });
      room -= take;
    }
  }
  const recovery = recoveries.reduce((sum, item) => sum + cents(item.amount), 0n);

  return {
    payBasis: employee.payBasis,
    periodDays,
    employedDays: String(employed),
    paidDays,
    unpaidDays,
    unrecordedDays: unrecorded,
    overtimeHours: overtimeHoursText,
    basicEarned: centsToDecimalString(basicEarned),
    allowancesEarned: centsToDecimalString(allowancesEarned),
    overtimePay: centsToDecimalString(overtimePay),
    grossPay: centsToDecimalString(gross),
    fixedDeduction: centsToDecimalString(fixed),
    advanceRecovery: centsToDecimalString(recovery),
    netPay: centsToDecimalString(gross - fixed - recovery),
    recoveries,
  };
}

/* Overtime hours are stored with up to 2 decimals; sum them exactly. */
function scaledHundredths(text: string) {
  return cents(text);
}

function minBig(a: bigint, b: bigint) {
  return a < b ? a : b;
}

/* Applies a manual earning/deduction to a calculated line; null if net would go negative. */
export function adjustLine(
  line: { grossPay: string; fixedDeduction: string; advanceRecovery: string; basicEarned: string; allowancesEarned: string; overtimePay: string },
  otherEarning: string,
  otherDeduction: string,
) {
  const gross = cents(line.basicEarned) + cents(line.allowancesEarned) + cents(line.overtimePay) + cents(otherEarning);
  const net = gross - cents(line.fixedDeduction) - cents(line.advanceRecovery) - cents(otherDeduction);
  if (net < 0n) return null;
  return {
    otherEarning: centsToDecimalString(cents(otherEarning)),
    otherDeduction: centsToDecimalString(cents(otherDeduction)),
    grossPay: centsToDecimalString(gross),
    netPay: centsToDecimalString(net),
  };
}

export function sumMoney(values: string[]) {
  return centsToDecimalString(values.reduce((sum, value) => sum + cents(value), 0n));
}
