/*
 * Salary advances and payroll runs (D-027).
 *
 * Run      DRAFT (calculated from attendance, pay rates and open advances;
 *          recalculable; manual earning/deduction per line) -> APPROVED ->
 *          PAID. Only drafts can be cancelled. One active run per month
 *          (partial unique index); creation and approval hold the month's
 *          advisory lock, which attendance saving also takes.
 * Approval recalculates and refuses if anything changed since the draft
 *          (PAYROLL_STALE), then applies each advance recovery once with a
 *          conditional update and locks the month's attendance.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, subtractDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { postPayrollApproved, postPayrollPaid, postSalaryAdvance, reverseSalaryAdvance } from "../ledger/postings";
import { lockPayrollPeriod } from "./hr.service";
import { adjustLine, calculatePayrollLine, employedDays, periodBounds, sumMoney, type AttendanceStatus } from "./payroll-rules";
import type { AdvanceInput } from "./hr.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const money = (value: unknown) => sumMoney([String(value ?? "0")]);

function runNotFound(): never {
  throw new AppError("Payroll run not found.", { code: "PAYROLL_RUN_NOT_FOUND", status: 404 });
}

async function rows<T>(tx: Tx, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

/* ------------------------------------------------------------------ */
/* Advances                                                            */
/* ------------------------------------------------------------------ */

export async function createAdvance(input: AdvanceInput, actorId: string) {
  const employee = await db.orm.public.Employee.where({ id: input.employeeId }).first();
  if (!employee || employee.status !== "ACTIVE") {
    throw new AppError("Advances can only be given to active employees.", { code: "EMPLOYEE_NOT_ACTIVE", status: 409 });
  }
  const replay = await db.orm.public.SalaryAdvance.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getAdvance(replay.id);

  const id = await db.transaction(async (tx) => {
    const advanceNumber = await allocateDocumentNumber(tx, "ADV");
    const advance = await tx.orm.public.SalaryAdvance.create({
      advanceNumber,
      employeeId: employee.id,
      issueDate: input.issueDate,
      amount: toPlainDecimalString(input.amount),
      installment: toPlainDecimalString(input.installment),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      createdBy: actorId,
    });
    await postSalaryAdvance(tx, advance.id, actorId);
    await recordAuditEvent({ actorId, action: "SALARY_ADVANCE_ISSUED", entityType: "SalaryAdvance", entityId: advance.id, metadata: { advanceNumber, amount: input.amount } }, tx);
    return advance.id;
  }).catch(async (error) => {
    if ((findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505") {
      const original = await db.orm.public.SalaryAdvance.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return original.id;
    }
    throw error;
  });
  return getAdvance(id);
}

export async function cancelAdvance(id: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Advance not found.", { code: "ADVANCE_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const updated = await rows<{ id: string }>(tx, db.raw.sql`
      update erp_salary_advances set status = 'CANCELLED', "cancelledBy" = ${actorId}::uuid, "cancelledAt" = now()
      where id = ${id}::uuid and status = 'OPEN' and recovered = 0
      returning id::text as id
    `.returnsRow({ id: "pg/text@1" }).build());
    if (!updated.length) {
      throw new AppError("Only open advances with nothing recovered yet can be cancelled.", { code: "ADVANCE_NOT_CANCELLABLE", status: 409 });
    }
    await reverseSalaryAdvance(tx, id, actorId);
    await recordAuditEvent({ actorId, action: "SALARY_ADVANCE_CANCELLED", entityType: "SalaryAdvance", entityId: id }, tx);
  });
  return getAdvance(id);
}

export async function getAdvance(id: string) {
  const advance = await db.orm.public.SalaryAdvance.where({ id }).first();
  if (!advance) throw new AppError("Advance not found.", { code: "ADVANCE_NOT_FOUND", status: 404 });
  const employee = await db.orm.public.Employee.where({ id: advance.employeeId }).first();
  return {
    ...advance,
    amount: money(advance.amount),
    installment: money(advance.installment),
    recovered: money(advance.recovered),
    remaining: money(subtractDecimalStrings(dec(advance.amount), dec(advance.recovered))),
    employeeName: employee?.name ?? null,
    employeeCode: employee?.employeeCode ?? null,
  };
}

export async function listAdvances(filters: { status?: string; employeeId?: string }) {
  let query = db.orm.public.SalaryAdvance;
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.employeeId) query = query.where({ employeeId: filters.employeeId });
  const advances = await query.orderBy((row) => row.createdAt.desc()).limit(500).all();
  const employees = advances.length ? await db.orm.public.Employee.where((row) => row.id.in([...new Set(advances.map((advance) => advance.employeeId))])).all() : [];
  return advances.map((advance) => {
    const employee = employees.find((item) => item.id === advance.employeeId);
    return {
      ...advance,
      amount: money(advance.amount),
      installment: money(advance.installment),
      recovered: money(advance.recovered),
      remaining: money(subtractDecimalStrings(dec(advance.amount), dec(advance.recovered))),
      employeeName: employee?.name ?? null,
      employeeCode: employee?.employeeCode ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Calculation                                                         */
/* ------------------------------------------------------------------ */

async function calculatePeriod(tx: Tx, period: string) {
  const { start, end } = periodBounds(period);
  const employees = (await tx.orm.public.Employee.where((row) => row.joinDate.lte(end)).all())
    .filter((employee) => !employee.leftDate || employee.leftDate >= start)
    .filter((employee) => employedDays(period, employee.joinDate, employee.leftDate) > 0);
  const ids = employees.map((employee) => employee.id);
  const attendance = ids.length
    ? await tx.orm.public.AttendanceRecord.where((row) => row.employeeId.in(ids)).where((row) => row.date.like(`${period}-%`)).all()
    : [];
  const advances = ids.length
    ? await tx.orm.public.SalaryAdvance.where({ status: "OPEN" }).where((row) => row.employeeId.in(ids)).where((row) => row.issueDate.lte(end)).orderBy((row) => row.createdAt.asc()).all()
    : [];

  return employees.map((employee) => ({
    employee,
    line: calculatePayrollLine(
      period,
      {
        payBasis: employee.payBasis as "MONTHLY" | "DAILY",
        joinDate: employee.joinDate,
        leftDate: employee.leftDate,
        basicSalary: dec(employee.basicSalary),
        allowances: dec(employee.allowances),
        overtimeRate: dec(employee.overtimeRate),
        fixedDeduction: dec(employee.fixedDeduction),
      },
      attendance
        .filter((record) => record.employeeId === employee.id)
        .map((record) => ({ date: record.date, status: record.status as AttendanceStatus, overtimeHours: dec(record.overtimeHours) })),
      advances
        .filter((advance) => advance.employeeId === employee.id)
        .map((advance) => ({ id: advance.id, installment: dec(advance.installment), remaining: subtractDecimalStrings(dec(advance.amount), dec(advance.recovered)) })),
    ),
  }));
}

type Calculated = Awaited<ReturnType<typeof calculatePeriod>>;

async function writeLines(tx: Tx, runId: string, calculated: Calculated, keep: Map<string, { otherEarning: string; otherDeduction: string; adjustmentNote: string | null }>) {
  await tx.orm.public.PayrollLine.where({ runId }).deleteAll();
  const totals = { gross: [] as string[], deductions: [] as string[], net: [] as string[] };
  for (const { employee, line } of calculated) {
    const manual = keep.get(employee.id);
    let gross = line.grossPay;
    let net = line.netPay;
    let otherEarning = "0";
    let otherDeduction = "0";
    if (manual) {
      const adjusted = adjustLine(line, manual.otherEarning, manual.otherDeduction);
      if (!adjusted) {
        throw new AppError(`${employee.name}: the manual deduction now exceeds pay. Change the adjustment first.`, { code: "PAYROLL_ADJUSTMENT_INVALID", status: 409 });
      }
      ({ grossPay: gross, netPay: net, otherEarning, otherDeduction } = adjusted);
    }
    await tx.orm.public.PayrollLine.create({
      runId,
      employeeId: employee.id,
      payBasis: line.payBasis,
      basicSalary: dec(employee.basicSalary),
      allowances: dec(employee.allowances),
      employedDays: line.employedDays,
      paidDays: line.paidDays,
      unpaidDays: line.unpaidDays,
      unrecordedDays: line.unrecordedDays,
      overtimeHours: line.overtimeHours,
      overtimeRate: dec(employee.overtimeRate),
      basicEarned: line.basicEarned,
      allowancesEarned: line.allowancesEarned,
      overtimePay: line.overtimePay,
      otherEarning,
      grossPay: gross,
      fixedDeduction: line.fixedDeduction,
      advanceRecovery: line.advanceRecovery,
      otherDeduction,
      netPay: net,
      adjustmentNote: manual?.adjustmentNote ?? null,
    });
    totals.gross.push(gross);
    totals.net.push(net);
    totals.deductions.push(line.fixedDeduction, line.advanceRecovery, otherDeduction);
  }
  const grossTotal = sumMoney(totals.gross);
  const deductionTotal = sumMoney(totals.deductions);
  await tx.orm.public.PayrollRun.where({ id: runId }).update({
    employeeCount: calculated.length,
    grossTotal,
    deductionTotal,
    netTotal: sumMoney([grossTotal, `-${deductionTotal}`]),
    calculatedAt: new Date().toISOString(),
  });
}

async function manualAdjustments(tx: Tx, runId: string) {
  const lines = await tx.orm.public.PayrollLine.where({ runId }).all();
  return new Map(lines
    .filter((line) => Number(dec(line.otherEarning)) !== 0 || Number(dec(line.otherDeduction)) !== 0 || line.adjustmentNote)
    .map((line) => [line.employeeId, { otherEarning: dec(line.otherEarning), otherDeduction: dec(line.otherDeduction), adjustmentNote: line.adjustmentNote }]));
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export async function createPayrollRun(period: string, notes: string, actorId: string) {
  const { days } = periodBounds(period);
  try {
    const id = await db.transaction(async (tx) => {
      await lockPayrollPeriod(tx, period);
      const runNumber = await allocateDocumentNumber(tx, "PAY");
      const run = await tx.orm.public.PayrollRun.create({
        runNumber, period, periodDays: days, employeeCount: 0, grossTotal: "0", deductionTotal: "0", netTotal: "0", notes: notes || null, createdBy: actorId,
      });
      await writeLines(tx, run.id, await calculatePeriod(tx, period), new Map());
      await recordAuditEvent({ actorId, action: "PAYROLL_RUN_CREATED", entityType: "PayrollRun", entityId: run.id, metadata: { runNumber, period } }, tx);
      return run.id;
    });
    return getPayrollRun(id);
  } catch (error) {
    if ((findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505") {
      throw new AppError(`There is already a payroll run for ${period}. Cancel the draft to start again.`, { code: "PAYROLL_PERIOD_EXISTS", status: 409 });
    }
    throw error;
  }
}

async function lockRun(tx: Tx, id: string) {
  const [run] = await rows<{ status: string; period: string }>(tx, db.raw.sql`
    select status, period from erp_payroll_runs where id = ${id}::uuid for update
  `.returnsRow({ status: "pg/text@1", period: "pg/text@1" }).build());
  if (!run) runNotFound();
  return run;
}

export async function adjustPayrollLine(runId: string, lineId: string, input: { otherEarning: number; otherDeduction: number; adjustmentNote?: string }, actorId: string) {
  if (!UUID.test(runId) || !UUID.test(lineId)) runNotFound();
  await db.transaction(async (tx) => {
    const run = await lockRun(tx, runId);
    if (run.status !== "DRAFT") throw new AppError("Only draft payroll runs can be adjusted.", { code: "PAYROLL_NOT_DRAFT", status: 409 });
    const line = await tx.orm.public.PayrollLine.where({ id: lineId, runId }).first();
    if (!line) throw new AppError("Payroll line not found.", { code: "PAYROLL_LINE_NOT_FOUND", status: 404 });
    const adjusted = adjustLine(
      { grossPay: dec(line.grossPay), fixedDeduction: dec(line.fixedDeduction), advanceRecovery: dec(line.advanceRecovery), basicEarned: dec(line.basicEarned), allowancesEarned: dec(line.allowancesEarned), overtimePay: dec(line.overtimePay) },
      toPlainDecimalString(input.otherEarning),
      toPlainDecimalString(input.otherDeduction),
    );
    if (!adjusted) throw new AppError("This deduction would make net pay negative.", { code: "PAYROLL_ADJUSTMENT_INVALID", status: 409 });
    await tx.orm.public.PayrollLine.where({ id: lineId }).update({ ...adjusted, adjustmentNote: input.adjustmentNote || null });

    const all = await tx.orm.public.PayrollLine.where({ runId }).all();
    const grossTotal = sumMoney(all.map((item) => dec(item.grossPay)));
    const deductionTotal = sumMoney(all.flatMap((item) => [dec(item.fixedDeduction), dec(item.advanceRecovery), dec(item.otherDeduction)]));
    await tx.orm.public.PayrollRun.where({ id: runId }).update({ grossTotal, deductionTotal, netTotal: sumMoney([grossTotal, `-${deductionTotal}`]) });
    await recordAuditEvent({ actorId, action: "PAYROLL_LINE_ADJUSTED", entityType: "PayrollRun", entityId: runId, metadata: { lineId, ...adjusted, note: input.adjustmentNote || null } }, tx);
  });
  return getPayrollRun(runId);
}

export async function changePayrollRun(id: string, action: "recalculate" | "approve" | "pay" | "cancel", paymentReference: string, actorId: string) {
  if (!UUID.test(id)) runNotFound();
  await db.transaction(async (tx) => {
    const { period } = await lockRun(tx, id);
    await lockPayrollPeriod(tx, period);
    const run = (await tx.orm.public.PayrollRun.where({ id }).first())!;
    const required = { recalculate: "DRAFT", approve: "DRAFT", pay: "APPROVED", cancel: "DRAFT" }[action];
    if (run.status !== required) {
      throw new AppError(`A ${run.status.toLowerCase()} payroll run cannot be ${{ recalculate: "recalculated", approve: "approved", pay: "marked paid", cancel: "cancelled" }[action]}.`, { code: "PAYROLL_STATUS_CONFLICT", status: 409 });
    }

    if (action === "recalculate") {
      await writeLines(tx, id, await calculatePeriod(tx, period), await manualAdjustments(tx, id));
    }

    if (action === "approve") {
      const calculated = await calculatePeriod(tx, period);
      const stored = await tx.orm.public.PayrollLine.where({ runId: id }).all();
      const stale = calculated.length !== stored.length || calculated.some(({ employee, line }) => {
        const existing = stored.find((item) => item.employeeId === employee.id);
        return !existing
          || money(existing.basicEarned) !== line.basicEarned
          || money(existing.allowancesEarned) !== line.allowancesEarned
          || money(existing.overtimePay) !== line.overtimePay
          || money(existing.fixedDeduction) !== line.fixedDeduction
          || money(existing.advanceRecovery) !== line.advanceRecovery;
      });
      if (stale) {
        throw new AppError("Attendance, pay rates or advances changed since this payroll was calculated. Recalculate and review it before approving.", { code: "PAYROLL_STALE", status: 409 });
      }
      for (const { line } of calculated) {
        for (const recovery of line.recoveries) {
          const applied = await rows<{ id: string }>(tx, db.raw.sql`
            update erp_salary_advances
              set recovered = recovered + ${recovery.amount}::numeric,
                  status = case when recovered + ${recovery.amount}::numeric = amount then 'CLOSED' else status end
            where id = ${recovery.advanceId}::uuid and status = 'OPEN' and recovered + ${recovery.amount}::numeric <= amount
            returning id::text as id
          `.returnsRow({ id: "pg/text@1" }).build());
          if (!applied.length) {
            throw new AppError("An advance changed during approval. Recalculate and try again.", { code: "PAYROLL_STALE", status: 409 });
          }
        }
      }
      await tx.orm.public.PayrollRun.where({ id }).update({ status: "APPROVED", approvedBy: actorId, approvedAt: new Date().toISOString() });
      await postPayrollApproved(tx, id, actorId);
    }

    if (action === "pay") {
      await tx.orm.public.PayrollRun.where({ id }).update({ status: "PAID", paidAt: new Date().toISOString(), paymentReference: paymentReference || null });
      await postPayrollPaid(tx, id, actorId);
    }

    if (action === "cancel") {
      await tx.orm.public.PayrollRun.where({ id }).update({ status: "CANCELLED", cancelledBy: actorId, cancelledAt: new Date().toISOString() });
    }

    await recordAuditEvent({ actorId, action: `PAYROLL_RUN_${action.toUpperCase()}`, entityType: "PayrollRun", entityId: id, metadata: { runNumber: run.runNumber, period } }, tx);
  });
  return getPayrollRun(id);
}

export async function getPayrollRun(id: string) {
  if (!UUID.test(id)) runNotFound();
  const run = await db.orm.public.PayrollRun.where({ id }).first();
  if (!run) runNotFound();
  const lines = await db.orm.public.PayrollLine.where({ runId: id }).all();
  const employees = lines.length ? await db.orm.public.Employee.where((row) => row.id.in(lines.map((line) => line.employeeId))).all() : [];
  const departments = await db.orm.public.Department.all();
  const fields = ["basicSalary", "allowances", "overtimeRate", "basicEarned", "allowancesEarned", "overtimePay", "otherEarning", "grossPay", "fixedDeduction", "advanceRecovery", "otherDeduction", "netPay"] as const;
  return {
    ...run,
    grossTotal: money(run.grossTotal),
    deductionTotal: money(run.deductionTotal),
    netTotal: money(run.netTotal),
    lines: lines
      .map((line) => {
        const employee = employees.find((item) => item.id === line.employeeId);
        const out: Record<string, unknown> = {
          ...line,
          employeeCode: employee?.employeeCode ?? null,
          employeeName: employee?.name ?? null,
          designation: employee?.designation ?? null,
          departmentName: departments.find((item) => item.id === employee?.departmentId)?.name ?? null,
          bankAccount: employee?.bankAccount ?? null,
          employedDays: dec(line.employedDays),
          paidDays: dec(line.paidDays),
          unpaidDays: dec(line.unpaidDays),
          overtimeHours: dec(line.overtimeHours),
        };
        for (const field of fields) out[field] = money(line[field]);
        return out;
      })
      .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName))),
  };
}

export async function listPayrollRuns() {
  const runs = await db.orm.public.PayrollRun.orderBy((row) => row.period.desc()).limit(120).all();
  return runs.map((run) => ({ ...run, grossTotal: money(run.grossTotal), deductionTotal: money(run.deductionTotal), netTotal: money(run.netTotal) }));
}
