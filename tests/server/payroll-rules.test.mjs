import assert from "node:assert/strict";
import test from "node:test";

import { adjustLine, calculatePayrollLine, employedDays, periodBounds, sumMoney } from "../../server/payroll/payroll-rules.ts";

const monthly = { payBasis: "MONTHLY", joinDate: "2025-01-01", leftDate: null, basicSalary: "31000", allowances: "3100", overtimeRate: "150", fixedDeduction: "0" };
const days = (from, to, status, overtimeHours = "0") => {
  const out = [];
  for (let day = from; day <= to; day += 1) out.push({ date: `2026-10-${String(day).padStart(2, "0")}`, status, overtimeHours });
  return out;
};

test("periods use calendar days, including leap years", () => {
  assert.deepEqual(periodBounds("2026-10"), { start: "2026-10-01", end: "2026-10-31", days: 31 });
  assert.equal(periodBounds("2028-02").days, 29);
  assert.equal(periodBounds("2026-02").days, 28);
  assert.throws(() => periodBounds("2026-13"), RangeError);
  assert.equal(employedDays("2026-10", "2026-10-11", null), 21);
  assert.equal(employedDays("2026-10", "2025-01-01", "2026-10-10"), 10);
  assert.equal(employedDays("2026-10", "2026-11-01", null), 0);
});

test("monthly staff: absences, unpaid leave and half days reduce pay; unrecorded days are paid but reported", () => {
  const records = [...days(1, 20, "PRESENT"), ...days(21, 22, "ABSENT"), ...days(23, 23, "HALF_DAY"), ...days(24, 24, "UNPAID_LEAVE"), ...days(25, 26, "PAID_LEAVE", "0")];
  const line = calculatePayrollLine("2026-10", monthly, records, []);
  // 31 − 2 absent − 1 unpaid − 0.5 = 27.5 paid days; days 27–31 have no record.
  assert.deepEqual([line.paidDays, line.unpaidDays, line.unrecordedDays], ["27.5", "3.5", 5]);
  assert.equal(line.basicEarned, "27500.00", "31000 × 27.5 / 31");
  assert.equal(line.allowancesEarned, "2750.00");
  assert.equal(line.grossPay, "30250.00");
});

test("daily wagers are paid only for recorded work; overtime is hours × rate", () => {
  const worker = { ...monthly, payBasis: "DAILY", basicSalary: "1200", allowances: "0", overtimeRate: "187.5" };
  const records = [...days(1, 10, "PRESENT", "1.5"), ...days(11, 11, "HALF_DAY"), ...days(12, 12, "HOLIDAY"), ...days(13, 13, "PAID_LEAVE")];
  const line = calculatePayrollLine("2026-10", worker, records, []);
  assert.equal(line.paidDays, "11.5");
  assert.equal(line.basicEarned, "13800.00");
  assert.equal(line.overtimeHours, "15.00");
  assert.equal(line.overtimePay, "2812.50");
  assert.equal(line.grossPay, "16612.50");
});

test("joiners and leavers are paid only for days employed", () => {
  const joiner = calculatePayrollLine("2026-10", { ...monthly, joinDate: "2026-10-16" }, [], []);
  assert.deepEqual([joiner.employedDays, joiner.paidDays, joiner.basicEarned], ["16", "16", "16000.00"]);
  const leaver = calculatePayrollLine("2026-10", { ...monthly, leftDate: "2026-10-05" }, days(1, 31, "PRESENT"), []);
  assert.deepEqual([leaver.paidDays, leaver.basicEarned], ["5", "5000.00"]);
});

test("deductions and advance recoveries never make net pay negative", () => {
  const employee = { ...monthly, basicSalary: "10000", allowances: "0", fixedDeduction: "1500" };
  const advances = [{ id: "a1", remaining: "2000", installment: "5000" }, { id: "a2", remaining: "9000", installment: "3000" }];
  const line = calculatePayrollLine("2026-10", employee, [], advances);
  assert.deepEqual(line.recoveries, [{ advanceId: "a1", amount: "2000.00" }, { advanceId: "a2", amount: "3000.00" }]);
  assert.equal(line.netPay, "3500.00");

  const short = calculatePayrollLine("2026-10", { ...employee, joinDate: "2026-10-30" }, [], advances);
  assert.equal(short.grossPay, "645.16");
  assert.deepEqual([short.fixedDeduction, short.advanceRecovery, short.netPay], ["645.16", "0.00", "0.00"]);
});

test("manual adjustments keep net pay non-negative and totals exact", () => {
  const line = calculatePayrollLine("2026-10", { ...monthly, fixedDeduction: "1000" }, [], []);
  assert.deepEqual(adjustLine(line, "500", "250.5"), { otherEarning: "500.00", otherDeduction: "250.50", grossPay: "34600.00", netPay: "33349.50" });
  assert.equal(adjustLine(line, "0", "40000"), null);
  assert.equal(sumMoney(["0.10", "0.20", "0.30"]), "0.60");
});
