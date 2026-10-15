import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createDepartment, createEmployee, getEmployee, listEmployees, saveAttendance, setEmployeePay, updateEmployee } from "../../server/payroll/hr.service.ts";
import { advanceInputSchema, attendanceSaveSchema, employeeInputSchema, employeeQuerySchema, employeeUpdateSchema } from "../../server/payroll/hr.validation.ts";
import { sumMoney } from "../../server/payroll/payroll-rules.ts";
import { adjustPayrollLine, cancelAdvance, changePayrollRun, createAdvance, createPayrollRun, getAdvance } from "../../server/payroll/payroll.service.ts";

const run = `P${Date.now().toString(36).toUpperCase()}`;
const actor = randomUUID();
// A unique far-future month per test run (one active payroll run per month).
const year = 2100 + (Date.now() % 700);
const period = `${year}-02`;
const day = (n) => `${period}-${String(n).padStart(2, "0")}`;
const ctx = {};

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
}

const employee = (code, extra = {}) => createEmployee(employeeInputSchema.parse({
  employeeCode: `${code}-${run}`, name: `${code} ${run}`, departmentId: ctx.department.id, designation: "Operator",
  employmentType: "PERMANENT", joinDate: "2000-01-01", nationalId: "35202-0000000-1", ...extra,
}), actor);

async function attend(date, records) {
  return saveAttendance(attendanceSaveSchema.parse({ date, records }), actor);
}

test.before(async () => {
  ctx.department = await createDepartment({ code: `P-${run}`.slice(0, 20), name: `Plating ${run}` }, actor);
  ctx.salaried = await employee("SAL");
  ctx.daily = await employee("DLY", { employmentType: "DAILY_WAGE" });
  await setEmployeePay(ctx.salaried.id, { payBasis: "MONTHLY", basicSalary: 28000, allowances: 2800, overtimeRate: 150, fixedDeduction: 500 }, actor);
  await setEmployeePay(ctx.daily.id, { payBasis: "DAILY", basicSalary: 1250, allowances: 0, overtimeRate: 200, fixedDeduction: 0 }, actor);
});

test("pay details are hidden without payroll:view", async () => {
  const hrView = await getEmployee(ctx.salaried.id, false);
  assert.equal("basicSalary" in hrView, false);
  assert.equal("bankAccount" in hrView, false);
  assert.equal(hrView.nationalId, "35202-0000000-1");
  const payrollView = await getEmployee(ctx.salaried.id, true);
  assert.equal(payrollView.basicSalary, "28000");
  const list = await listEmployees(employeeQuerySchema.parse({ search: run }), false);
  assert.ok(list.employees.every((row) => !("basicSalary" in row)));
});

test("attendance is one record per employee per day and only while employed", async () => {
  await attend(day(1), [{ employeeId: ctx.salaried.id, status: "PRESENT", overtimeHours: 2 }, { employeeId: ctx.daily.id, status: "PRESENT" }]);
  const saved = await attend(day(1), [{ employeeId: ctx.salaried.id, status: "PRESENT", overtimeHours: 3.5 }]);
  assert.equal(saved.records.find((row) => row.employeeId === ctx.salaried.id).overtimeHours, "3.5", "saving again updates the record");

  const leaver = await employee("LVR");
  await updateEmployee(leaver.id, employeeUpdateSchema.parse({
    name: leaver.name, departmentId: ctx.department.id, designation: leaver.designation, employmentType: leaver.employmentType,
    joinDate: leaver.joinDate, leftDate: day(10),
  }), actor);
  await expectCode(attend(day(11), [{ employeeId: leaver.id, status: "PRESENT" }]), "NOT_EMPLOYED_ON_DATE");
  ctx.leaver = leaver;

  for (let n = 2; n <= 20; n += 1) {
    await attend(day(n), [
      { employeeId: ctx.salaried.id, status: n === 5 ? "ABSENT" : n === 6 ? "HALF_DAY" : "PRESENT" },
      { employeeId: ctx.daily.id, status: n <= 15 ? "PRESENT" : "ABSENT" },
    ]);
  }
});

test("advances are idempotent and cancellable only before any recovery", async () => {
  const input = advanceInputSchema.parse({ idempotencyKey: randomUUID(), employeeId: ctx.salaried.id, issueDate: day(1), amount: 3000, installment: 2000, reason: "Medical" });
  const [first, second] = await Promise.all([createAdvance(input, actor), createAdvance(input, actor)]);
  assert.equal(first.id, second.id);
  ctx.advance = first;
  const spare = await createAdvance(advanceInputSchema.parse({ idempotencyKey: randomUUID(), employeeId: ctx.daily.id, issueDate: day(1), amount: 500, installment: 500, reason: "Test" }), actor);
  assert.equal((await cancelAdvance(spare.id, actor)).status, "CANCELLED");
  await expectCode(cancelAdvance(spare.id, actor), "ADVANCE_NOT_CANCELLABLE");
});

test("a payroll run calculates exactly, refuses stale approval, and locks the month once approved", async () => {
  const outcomes = await Promise.allSettled([createPayrollRun(period, "", actor), createPayrollRun(period, "", actor)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "PAYROLL_PERIOD_EXISTS");
  let payroll = outcomes.find((outcome) => outcome.status === "fulfilled").value;

  const line = (id) => payroll.lines.find((item) => item.employeeId === id);
  // February of a non-leap year 2100+? Use the run's own day count.
  const days = payroll.periodDays;
  const salaried = line(ctx.salaried.id);
  assert.equal(salaried.paidDays, String(days - 1.5));
  assert.equal(salaried.unrecordedDays, days - 20);
  assert.equal(salaried.overtimePay, "525.00", "3.5 h × 150");
  assert.equal(salaried.fixedDeduction, "500.00");
  assert.equal(salaried.advanceRecovery, "2000.00");
  const daily = line(ctx.daily.id);
  assert.deepEqual([daily.paidDays, daily.basicEarned, daily.netPay], ["15", "18750.00", "18750.00"]);
  assert.equal(line(ctx.leaver.id).employedDays, "10");

  payroll = await adjustPayrollLine(payroll.id, daily.id, { otherEarning: 1000, otherDeduction: 250, adjustmentNote: "Attendance bonus less canteen" }, actor);
  assert.equal(line(ctx.daily.id).netPay, "19500.00");
  await expectCode(adjustPayrollLine(payroll.id, daily.id, { otherEarning: 0, otherDeduction: 999999 }, actor), "PAYROLL_ADJUSTMENT_INVALID");

  // Attendance changes after calculation make the draft stale.
  await attend(day(21), [{ employeeId: ctx.daily.id, status: "PRESENT" }]);
  await expectCode(changePayrollRun(payroll.id, "approve", "", actor), "PAYROLL_STALE");
  payroll = await changePayrollRun(payroll.id, "recalculate", "", actor);
  assert.equal(line(ctx.daily.id).paidDays, "16");
  assert.equal(line(ctx.daily.id).netPay, "20750.00", "the manual adjustment is kept on recalculation");

  payroll = await changePayrollRun(payroll.id, "approve", "", actor);
  assert.equal(payroll.status, "APPROVED");
  const advance = await getAdvance(ctx.advance.id);
  assert.deepEqual([advance.recovered, advance.remaining, advance.status], ["2000.00", "1000.00", "OPEN"]);

  await expectCode(attend(day(22), [{ employeeId: ctx.daily.id, status: "PRESENT" }]), "ATTENDANCE_LOCKED");
  await expectCode(changePayrollRun(payroll.id, "recalculate", "", actor), "PAYROLL_STATUS_CONFLICT");
  await expectCode(changePayrollRun(payroll.id, "cancel", "", actor), "PAYROLL_STATUS_CONFLICT");
  await expectCode(changePayrollRun(payroll.id, "approve", "", actor), "PAYROLL_STATUS_CONFLICT");
  payroll = await changePayrollRun(payroll.id, "pay", "Bank batch 17", actor);
  assert.deepEqual([payroll.status, payroll.paymentReference], ["PAID", "Bank batch 17"]);

  assert.equal(payroll.netTotal, sumMoney(payroll.lines.map((item) => item.netPay)), "run total equals the sum of net pay");
});

test("the next month recovers the rest of the advance and closes it", async () => {
  const next = `${year}-03`;
  const payroll = await createPayrollRun(next, "", actor);
  assert.equal(payroll.lines.find((item) => item.employeeId === ctx.salaried.id).advanceRecovery, "1000.00");
  await changePayrollRun(payroll.id, "approve", "", actor);
  const advance = await getAdvance(ctx.advance.id);
  assert.deepEqual([advance.recovered, advance.status], ["3000.00", "CLOSED"]);
});
