/*
 * Shifts and leave (D-032).
 *
 * Shifts are named working hours; each employee may be assigned one.
 * Leave types carry an annual entitlement (0 = not limited). A request
 * counts the dates in its range that are not company holidays or
 * shutdowns (Planning calendar). Approval:
 *   - refuses overlapping pending/approved requests for the employee,
 *   - refuses going over the year's entitlement for that type,
 *   - refuses dates in a payroll period that is already approved,
 *   - writes PAID_LEAVE / UNPAID_LEAVE attendance for each counted date
 *     (refusing dates already marked present or half day),
 * all in one transaction under the employee's and periods' locks, so
 * payroll picks the leave up. Cancelling an approved request removes the
 * attendance it wrote, while the period is still open.
 */

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { addDecimalStrings, compareDecimalStrings, normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import { allocateDocumentNumber, type Tx } from "../inventory/inventory.service";
import { lockPayrollPeriod, periodIsLocked } from "./hr.service";
import type { LeaveRequestInput } from "./leave.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unique = (error: unknown) => (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));

async function rows<T>(tx: Tx | ReturnType<typeof db.runtime>, plan: unknown) {
  return (await tx.query(plan as never)) as unknown as T[];
}

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) out.push(new Date(time).toISOString().slice(0, 10));
  return out;
}

/* ------------------------------------------------------------------ */
/* Shifts                                                              */
/* ------------------------------------------------------------------ */

/* Paid minutes of a shift; overnight shifts wrap past midnight. */
export function shiftMinutes(start: string, end: string, breakMinutes: number) {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  let length = toMinutes(end) - toMinutes(start);
  if (length <= 0) length += 24 * 60;
  return Math.max(0, length - breakMinutes);
}

export async function listShifts() {
  const shifts = await db.orm.public.Shift.orderBy((row) => row.code.asc()).all();
  const counts = await rows<{ shiftId: string; count: string }>(db.runtime(), db.raw.sql`
    select "shiftId"::text as "shiftId", count(*)::text as count from erp_employees where "shiftId" is not null and status = 'ACTIVE' group by 1
  `.returnsRow({ shiftId: "pg/text@1", count: "pg/text@1" }).build());
  return shifts.map((shift) => ({ ...shift, paidMinutes: shiftMinutes(shift.startTime, shift.endTime, shift.breakMinutes), overnight: shift.endTime < shift.startTime, employees: Number(counts.find((row) => row.shiftId === shift.id)?.count ?? 0) }));
}

export async function createShift(input: { code: string; name: string; startTime: string; endTime: string; breakMinutes: number }, actorId: string) {
  try {
    const shift = await db.orm.public.Shift.create(input);
    await recordAuditEvent({ actorId, action: "SHIFT_CREATED", entityType: "Shift", entityId: shift.id, metadata: { code: input.code } });
    return shift;
  } catch (error) {
    if (unique(error)) throw new AppError("A shift with that code already exists.", { code: "SHIFT_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateShift(id: string, input: { name: string; startTime: string; endTime: string; breakMinutes: number; status: "ACTIVE" | "INACTIVE" }, actorId: string) {
  if (!UUID.test(id) || !(await db.orm.public.Shift.where({ id }).first())) throw new AppError("Shift not found.", { code: "SHIFT_NOT_FOUND", status: 404 });
  await db.orm.public.Shift.where({ id }).update(input);
  await recordAuditEvent({ actorId, action: "SHIFT_UPDATED", entityType: "Shift", entityId: id, metadata: { status: input.status } });
  return db.orm.public.Shift.where({ id }).first();
}

export async function assignShift(employeeIds: string[], shiftId: string | null, actorId: string) {
  if (shiftId) {
    const shift = await db.orm.public.Shift.where({ id: shiftId }).first();
    if (!shift || shift.status !== "ACTIVE") throw new AppError("Choose an active shift.", { code: "SHIFT_NOT_ACTIVE", status: 409 });
  }
  const employees = await db.orm.public.Employee.where((row) => row.id.in(employeeIds)).all();
  if (employees.length !== new Set(employeeIds).size) throw new AppError("An employee was not found.", { code: "EMPLOYEE_NOT_FOUND", status: 400 });
  await db.transaction(async (tx) => {
    for (const id of employeeIds) await tx.orm.public.Employee.where({ id }).update({ shiftId, updatedAt: new Date().toISOString() });
    await recordAuditEvent({ actorId, action: "SHIFT_ASSIGNED", entityType: "Shift", entityId: shiftId, metadata: { employees: employeeIds.length } }, tx);
  });
  return { updated: employeeIds.length };
}

/* Active employees with their shift, for the roster. */
export async function listRoster() {
  return rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select e.id::text as id, e."employeeCode", e.name, d.name as department, coalesce(s.code, '') as "shiftCode", coalesce(s.id::text, '') as "shiftId"
    from erp_employees e join erp_departments d on d.id = e."departmentId" left join erp_shifts s on s.id = e."shiftId"
    where e.status = 'ACTIVE' order by d.name, e."employeeCode"
  `.returnsRow({ id: "pg/text@1", employeeCode: "pg/text@1", name: "pg/text@1", department: "pg/text@1", shiftCode: "pg/text@1", shiftId: "pg/text@1" }).build());
}

/* ------------------------------------------------------------------ */
/* Leave types                                                         */
/* ------------------------------------------------------------------ */

export async function listLeaveTypes() {
  return (await db.orm.public.LeaveType.orderBy((row) => row.code.asc()).all()).map((row) => ({ ...row, annualDays: dec(row.annualDays) }));
}

export async function createLeaveType(input: { code: string; name: string; paid: boolean; annualDays: number }, actorId: string) {
  try {
    const type = await db.orm.public.LeaveType.create({ ...input, annualDays: toPlainDecimalString(input.annualDays) });
    await recordAuditEvent({ actorId, action: "LEAVE_TYPE_CREATED", entityType: "LeaveType", entityId: type.id, metadata: { code: input.code } });
    return type;
  } catch (error) {
    if (unique(error)) throw new AppError("A leave type with that code already exists.", { code: "LEAVE_TYPE_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateLeaveType(id: string, input: { name: string; annualDays: number; status: "ACTIVE" | "INACTIVE" }, actorId: string) {
  if (!UUID.test(id) || !(await db.orm.public.LeaveType.where({ id }).first())) throw new AppError("Leave type not found.", { code: "LEAVE_TYPE_NOT_FOUND", status: 404 });
  await db.orm.public.LeaveType.where({ id }).update({ name: input.name, annualDays: toPlainDecimalString(input.annualDays), status: input.status });
  await recordAuditEvent({ actorId, action: "LEAVE_TYPE_UPDATED", entityType: "LeaveType", entityId: id, metadata: { annualDays: input.annualDays, status: input.status } });
  return db.orm.public.LeaveType.where({ id }).first();
}

/* ------------------------------------------------------------------ */
/* Leave requests                                                      */
/* ------------------------------------------------------------------ */

async function nonWorkingDates(tx: Tx | ReturnType<typeof db.runtime>, from: string, to: string) {
  const days = await rows<{ date: string }>(tx, db.raw.sql`select date from erp_calendar_days where date between ${from} and ${to} and "dayType" in ('HOLIDAY', 'SHUTDOWN')`.returnsRow({ date: "pg/text@1" }).build());
  return new Set(days.map((row) => row.date));
}

export async function leaveDates(tx: Tx | ReturnType<typeof db.runtime>, from: string, to: string) {
  const closed = await nonWorkingDates(tx, from, to);
  return datesBetween(from, to).filter((date) => !closed.has(date));
}

export async function createLeaveRequest(input: LeaveRequestInput, actorId: string) {
  const replay = await db.orm.public.LeaveRequest.where({ idempotencyKey: input.idempotencyKey }).first();
  if (replay) return getLeaveRequest(replay.id);
  const employee = await db.orm.public.Employee.where({ id: input.employeeId }).first();
  if (!employee || employee.status !== "ACTIVE") throw new AppError("Leave can only be requested for active employees.", { code: "EMPLOYEE_NOT_ACTIVE", status: 409 });
  const type = await db.orm.public.LeaveType.where({ id: input.leaveTypeId }).first();
  if (!type || type.status !== "ACTIVE") throw new AppError("Choose an active leave type.", { code: "LEAVE_TYPE_NOT_ACTIVE", status: 409 });
  if (input.fromDate < employee.joinDate) throw new AppError(`${employee.name} joined on ${employee.joinDate}.`, { code: "NOT_EMPLOYED_ON_DATE", status: 409 });
  const dates = await leaveDates(db.runtime(), input.fromDate, input.toDate);
  if (!dates.length) throw new AppError("Every date in this range is a company holiday.", { code: "LEAVE_NO_WORKING_DAYS", status: 409 });
  try {
    const id = await db.transaction(async (tx) => {
      await tx.query(db.raw.sql`select pg_advisory_xact_lock(hashtext(${`leave:${input.employeeId}`}))::text as locked`.returnsRow({ locked: "pg/text@1" }).build());
      await refuseOverlap(tx, input.employeeId, input.fromDate, input.toDate, null);
      const requestNumber = await allocateDocumentNumber(tx, "LV");
      const request = await tx.orm.public.LeaveRequest.create({
        requestNumber, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, fromDate: input.fromDate, toDate: input.toDate,
        days: String(dates.length), reason: input.reason, idempotencyKey: input.idempotencyKey, createdBy: actorId,
      });
      await recordAuditEvent({ actorId, action: "LEAVE_REQUESTED", entityType: "LeaveRequest", entityId: request.id, metadata: { requestNumber, days: dates.length } }, tx);
      return request.id;
    });
    return getLeaveRequest(id);
  } catch (error) {
    if (unique(error)) {
      const original = await db.orm.public.LeaveRequest.where({ idempotencyKey: input.idempotencyKey }).first();
      if (original) return getLeaveRequest(original.id);
    }
    throw error;
  }
}

async function refuseOverlap(tx: Tx, employeeId: string, from: string, to: string, exceptId: string | null) {
  const overlap = await rows<{ requestNumber: string }>(tx, db.raw.sql`
    select "requestNumber" from erp_leave_requests
    where "employeeId" = ${employeeId}::uuid and status in ('PENDING', 'APPROVED') and "fromDate" <= ${to} and "toDate" >= ${from}
      and (${exceptId ?? ""} = '' or id::text <> ${exceptId ?? ""})
    limit 1
  `.returnsRow({ requestNumber: "pg/text@1" }).build());
  if (overlap.length) throw new AppError(`This overlaps leave request ${overlap[0].requestNumber}.`, { code: "LEAVE_OVERLAP", status: 409 });
}

async function lockPeriods(tx: Tx, dates: string[]) {
  const periods = [...new Set(dates.map((date) => date.slice(0, 7)))].sort();
  for (const period of periods) {
    await lockPayrollPeriod(tx, period);
    const locked = await periodIsLocked(tx, period);
    if (locked) throw new AppError(`Attendance for ${period} is locked: payroll ${locked} has been approved.`, { code: "ATTENDANCE_LOCKED", status: 409 });
  }
}

export async function changeLeaveRequest(id: string, action: "approve" | "reject" | "cancel", note: string, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Leave request not found.", { code: "LEAVE_NOT_FOUND", status: 404 });
  await db.transaction(async (tx) => {
    const found = await tx.orm.public.LeaveRequest.where({ id }).first();
    if (!found) throw new AppError("Leave request not found.", { code: "LEAVE_NOT_FOUND", status: 404 });
    await tx.query(db.raw.sql`select pg_advisory_xact_lock(hashtext(${`leave:${found.employeeId}`}))::text as locked`.returnsRow({ locked: "pg/text@1" }).build());
    const request = (await tx.orm.public.LeaveRequest.where({ id }).first())!;
    const type = (await tx.orm.public.LeaveType.where({ id: request.leaveTypeId }).first())!;
    const employee = (await tx.orm.public.Employee.where({ id: request.employeeId }).first())!;
    const dates = await leaveDates(tx, request.fromDate, request.toDate);
    const now = new Date().toISOString();

    if (action === "approve" || action === "reject") {
      if (request.status !== "PENDING") throw new AppError(`A ${request.status.toLowerCase()} request cannot be ${action}d.`, { code: "LEAVE_STATUS_CONFLICT", status: 409 });
    }
    if (action === "approve") {
      if (employee.status !== "ACTIVE") throw new AppError(`${employee.name} is no longer active.`, { code: "EMPLOYEE_NOT_ACTIVE", status: 409 });
      await refuseOverlap(tx, request.employeeId, request.fromDate, request.toDate, id);
      const entitlement = dec(type.annualDays);
      if (compareDecimalStrings(entitlement, "0") > 0) {
        for (const year of [...new Set(dates.map((date) => date.slice(0, 4)))]) {
          const used = await usedDays(tx, request.employeeId, type.id, year);
          const asked = String(dates.filter((date) => date.startsWith(year)).length);
          if (compareDecimalStrings(addDecimalStrings(used, asked), entitlement) > 0) {
            throw new AppError(`${employee.name} has ${normalizeDecimalString(String(Number(entitlement) - Number(used)))} of ${entitlement} ${type.name} days left in ${year}; this request needs ${asked}.`, { code: "LEAVE_BALANCE_EXCEEDED", status: 409 });
          }
        }
      }
      await lockPeriods(tx, dates);
      const status = type.paid ? "PAID_LEAVE" : "UNPAID_LEAVE";
      const clashes = await rows<{ date: string; status: string }>(tx, db.raw.sql`
        select date, status from erp_attendance_records
        where "employeeId" = ${request.employeeId}::uuid and date between ${request.fromDate} and ${request.toDate} and status in ('PRESENT', 'HALF_DAY')
      `.returnsRow({ date: "pg/text@1", status: "pg/text@1" }).build());
      const counted = new Set(dates);
      const blocking = clashes.filter((row) => counted.has(row.date));
      if (blocking.length) throw new AppError(`Attendance already shows ${employee.name} at work on ${blocking.map((row) => row.date).join(", ")}.`, { code: "LEAVE_ATTENDANCE_CONFLICT", status: 409 });
      for (const date of dates) {
        if (date < employee.joinDate || (employee.leftDate && date > employee.leftDate)) continue;
        await tx.query(db.raw.sql`
          insert into erp_attendance_records ("id", "employeeId", "date", "status", "overtimeHours", "remarks", "recordedBy", "recordedAt")
          values (gen_random_uuid(), ${request.employeeId}::uuid, ${date}, ${status}, 0, ${`Leave ${request.requestNumber}`}, ${actorId}::uuid, now())
          on conflict ("employeeId", "date") do update set status = excluded.status, "overtimeHours" = 0, remarks = excluded.remarks, "recordedBy" = excluded."recordedBy", "recordedAt" = now()
          returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build());
      }
      await tx.orm.public.LeaveRequest.where({ id }).update({ status: "APPROVED", decidedBy: actorId, decidedAt: now, decisionNote: note || null });
    } else if (action === "reject") {
      await tx.orm.public.LeaveRequest.where({ id }).update({ status: "REJECTED", decidedBy: actorId, decidedAt: now, decisionNote: note || null });
    } else {
      if (!["PENDING", "APPROVED"].includes(request.status)) throw new AppError(`A ${request.status.toLowerCase()} request cannot be cancelled.`, { code: "LEAVE_STATUS_CONFLICT", status: 409 });
      if (request.status === "APPROVED") {
        await lockPeriods(tx, dates);
        await tx.query(db.raw.sql`
          delete from erp_attendance_records
          where "employeeId" = ${request.employeeId}::uuid and date between ${request.fromDate} and ${request.toDate} and remarks = ${`Leave ${request.requestNumber}`}
          returning id::text as id
        `.returnsRow({ id: "pg/text@1" }).build());
      }
      await tx.orm.public.LeaveRequest.where({ id }).update({ status: "CANCELLED", decidedBy: actorId, decidedAt: now, decisionNote: note || null });
    }
    await recordAuditEvent({ actorId, action: `LEAVE_${action.toUpperCase()}`, entityType: "LeaveRequest", entityId: id, metadata: { requestNumber: request.requestNumber, note: note || null } }, tx);
  });
  return getLeaveRequest(id);
}

async function usedDays(tx: Tx | ReturnType<typeof db.runtime>, employeeId: string, leaveTypeId: string, year: string) {
  const approved = await rows<{ fromDate: string; toDate: string }>(tx, db.raw.sql`
    select "fromDate", "toDate" from erp_leave_requests
    where "employeeId" = ${employeeId}::uuid and "leaveTypeId" = ${leaveTypeId}::uuid and status = 'APPROVED' and "fromDate" <= ${`${year}-12-31`} and "toDate" >= ${`${year}-01-01`}
  `.returnsRow({ fromDate: "pg/text@1", toDate: "pg/text@1" }).build());
  let total = 0;
  for (const row of approved) total += (await leaveDates(tx, row.fromDate, row.toDate)).filter((date) => date.startsWith(year)).length;
  return String(total);
}

export async function getLeaveRequest(id: string) {
  const request = await db.orm.public.LeaveRequest.where({ id }).first();
  if (!request) throw new AppError("Leave request not found.", { code: "LEAVE_NOT_FOUND", status: 404 });
  const employee = await db.orm.public.Employee.where({ id: request.employeeId }).first();
  const type = await db.orm.public.LeaveType.where({ id: request.leaveTypeId }).first();
  return { ...request, days: dec(request.days), employeeName: employee?.name ?? null, employeeCode: employee?.employeeCode ?? null, leaveTypeName: type?.name ?? null, paid: type?.paid ?? null };
}

export async function listLeaveRequests(filters: { status: string; employeeId?: string; page: number; pageSize: number }) {
  const result = await rows<Record<string, string>>(db.runtime(), db.raw.sql`
    select r.id::text as id, r."requestNumber", r."fromDate", r."toDate", r.days::text as days, r.reason, r.status, coalesce(r."decisionNote", '') as "decisionNote",
      e.name as "employeeName", e."employeeCode", t.name as "leaveTypeName", t.paid::text as paid
    from erp_leave_requests r join erp_employees e on e.id = r."employeeId" join erp_leave_types t on t.id = r."leaveTypeId"
    where (${filters.status} = '' or r.status = ${filters.status}) and (${filters.employeeId ?? ""} = '' or r."employeeId"::text = ${filters.employeeId ?? ""})
    order by (r.status = 'PENDING') desc, r."fromDate" desc, r."requestNumber" desc
    limit ${filters.pageSize + 1} offset ${(filters.page - 1) * filters.pageSize}
  `.returnsRow({ id: "pg/text@1", requestNumber: "pg/text@1", fromDate: "pg/text@1", toDate: "pg/text@1", days: "pg/text@1", reason: "pg/text@1", status: "pg/text@1", decisionNote: "pg/text@1", employeeName: "pg/text@1", employeeCode: "pg/text@1", leaveTypeName: "pg/text@1", paid: "pg/text@1" }).build());
  return { requests: result.slice(0, filters.pageSize).map((row) => ({ ...row, days: dec(row.days), paid: row.paid === "true" })), page: filters.page, pageSize: filters.pageSize, hasMore: result.length > filters.pageSize };
}

/* Entitlement, used (approved) and pending days per employee and limited type for a year. */
export async function getLeaveBalances(year: number) {
  const employees = await db.orm.public.Employee.where({ status: "ACTIVE" }).orderBy((row) => row.employeeCode.asc()).all();
  const types = (await db.orm.public.LeaveType.where({ status: "ACTIVE" }).orderBy((row) => row.code.asc()).all()).filter((type) => compareDecimalStrings(dec(type.annualDays), "0") > 0);
  const requests = await rows<{ employeeId: string; leaveTypeId: string; status: string; fromDate: string; toDate: string }>(db.runtime(), db.raw.sql`
    select "employeeId"::text as "employeeId", "leaveTypeId"::text as "leaveTypeId", status, "fromDate", "toDate" from erp_leave_requests
    where status in ('PENDING', 'APPROVED') and "fromDate" <= ${`${year}-12-31`} and "toDate" >= ${`${year}-01-01`}
  `.returnsRow({ employeeId: "pg/text@1", leaveTypeId: "pg/text@1", status: "pg/text@1", fromDate: "pg/text@1", toDate: "pg/text@1" }).build());
  const closed = await nonWorkingDates(db.runtime(), `${year}-01-01`, `${year}-12-31`);
  const count = (row: (typeof requests)[number]) => datesBetween(row.fromDate, row.toDate).filter((date) => date.startsWith(String(year)) && !closed.has(date)).length;
  return {
    year,
    types: types.map((type) => ({ id: type.id, code: type.code, name: type.name, annualDays: dec(type.annualDays) })),
    employees: employees.map((employee) => ({
      id: employee.id, employeeCode: employee.employeeCode, name: employee.name,
      balances: types.map((type) => {
        const mine = requests.filter((row) => row.employeeId === employee.id && row.leaveTypeId === type.id);
        const used = mine.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + count(row), 0);
        const pending = mine.filter((row) => row.status === "PENDING").reduce((sum, row) => sum + count(row), 0);
        return { leaveTypeId: type.id, entitlement: dec(type.annualDays), used: String(used), pending: String(pending), remaining: normalizeDecimalString(String(Number(dec(type.annualDays)) - used)) };
      }),
    })),
  };
}
