/*
 * Departments, employees and attendance (D-027).
 *
 * Pay fields are returned only when the caller holds payroll:view, and
 * changed only through payroll (setEmployeePay). Attendance for a month is
 * locked once that month's payroll run is approved; saving attendance and
 * approving payroll take the same per-month advisory lock.
 */

import { or } from "@prisma/orm-postgres/orm-client";

import { recordAuditEvent } from "../auth/audit.service";
import { db } from "../core/database/client";
import { AppError } from "../core/errors/app-error";
import { findSqlQueryError } from "../core/errors/database-errors";
import { normalizeDecimalString, toPlainDecimalString } from "../core/utils/decimal";
import type { Tx } from "../inventory/inventory.service";
import { isEmployedOn } from "./payroll-rules";
import type { AttendanceSave, EmployeeInput, EmployeePay, EmployeeQuery, EmployeeUpdate } from "./hr.validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dec = (value: unknown) => normalizeDecimalString(String(value ?? "0"));
const PAY_FIELDS = ["payBasis", "basicSalary", "allowances", "overtimeRate", "fixedDeduction", "bankAccount"] as const;

function employeeNotFound(): never {
  throw new AppError("Employee not found.", { code: "EMPLOYEE_NOT_FOUND", status: 404 });
}

function isUnique(error: unknown) {
  return (findSqlQueryError(error) as { sqlState?: string } | null)?.sqlState === "23505";
}

export async function lockPayrollPeriod(tx: Tx, period: string) {
  await tx.query(db.raw.sql`select pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))::text as locked`
    .returnsRow({ locked: "pg/text@1" }).build() as never);
}

export async function periodIsLocked(tx: Tx | null, period: string) {
  const runner = (tx ?? db) as Tx;
  const run = await runner.orm.public.PayrollRun.where((row) => row.status.in(["APPROVED", "PAID"])).where({ period }).first();
  return run ? run.runNumber : null;
}

/* ------------------------------------------------------------------ */
/* Departments                                                         */
/* ------------------------------------------------------------------ */

export async function listDepartments() {
  const departments = await db.orm.public.Department.orderBy((row) => row.name.asc()).all();
  const employees = await db.orm.public.Employee.where({ status: "ACTIVE" }).select("departmentId").all();
  return departments.map((department) => ({ ...department, activeEmployees: employees.filter((employee) => employee.departmentId === department.id).length }));
}

export async function createDepartment(input: { code: string; name: string }, actorId: string) {
  try {
    const department = await db.orm.public.Department.create({ code: input.code, name: input.name });
    await recordAuditEvent({ actorId, action: "DEPARTMENT_CREATED", entityType: "Department", entityId: department.id, metadata: input });
    return department;
  } catch (error) {
    if (isUnique(error)) throw new AppError("A department with that code or name already exists.", { code: "DEPARTMENT_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateDepartment(id: string, input: { name: string; status: string }, actorId: string) {
  if (!UUID.test(id)) throw new AppError("Department not found.", { code: "DEPARTMENT_NOT_FOUND", status: 404 });
  const department = await db.orm.public.Department.where({ id }).first();
  if (!department) throw new AppError("Department not found.", { code: "DEPARTMENT_NOT_FOUND", status: 404 });
  try {
    await db.orm.public.Department.where({ id }).update({ name: input.name, status: input.status, updatedAt: new Date().toISOString() });
  } catch (error) {
    if (isUnique(error)) throw new AppError("A department with that name already exists.", { code: "DEPARTMENT_EXISTS", status: 409 });
    throw error;
  }
  await recordAuditEvent({ actorId, action: "DEPARTMENT_UPDATED", entityType: "Department", entityId: id, metadata: input });
  return db.orm.public.Department.where({ id }).first();
}

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

function present(employee: Record<string, unknown>, departmentName: string | null, canViewPay: boolean) {
  const result: Record<string, unknown> = { ...employee, departmentName };
  if (canViewPay) {
    for (const field of ["basicSalary", "allowances", "overtimeRate", "fixedDeduction"]) result[field] = dec(employee[field]);
  } else {
    for (const field of PAY_FIELDS) delete result[field];
  }
  return result;
}

export async function listEmployees(filters: EmployeeQuery, canViewPay: boolean) {
  let query = db.orm.public.Employee;
  if (filters.status) query = query.where({ status: filters.status });
  if (filters.departmentId) query = query.where({ departmentId: filters.departmentId });
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.where((row) => or(row.name.ilike(pattern), row.employeeCode.ilike(pattern), row.designation.ilike(pattern)));
  }
  const result = await query.orderBy((row) => row.name.asc()).offset((filters.page - 1) * filters.pageSize).limit(filters.pageSize + 1).all();
  const page = result.slice(0, filters.pageSize);
  const departments = await db.orm.public.Department.all();
  return {
    employees: page.map((employee) => present(employee as never, departments.find((item) => item.id === employee.departmentId)?.name ?? null, canViewPay)),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: result.length > filters.pageSize,
  };
}

export async function getEmployee(id: string, canViewPay: boolean) {
  if (!UUID.test(id)) employeeNotFound();
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) employeeNotFound();
  const department = await db.orm.public.Department.where({ id: employee.departmentId }).first();
  return present(employee as never, department?.name ?? null, canViewPay);
}

async function requireActiveDepartment(departmentId: string) {
  const department = await db.orm.public.Department.where({ id: departmentId }).first();
  if (!department || department.status !== "ACTIVE") {
    throw new AppError("Choose an active department.", { code: "DEPARTMENT_NOT_ACTIVE", status: 400 });
  }
}

export async function createEmployee(input: EmployeeInput, actorId: string) {
  await requireActiveDepartment(input.departmentId);
  try {
    const employee = await db.orm.public.Employee.create({
      employeeCode: input.employeeCode,
      name: input.name,
      fatherName: input.fatherName || null,
      nationalId: input.nationalId || null,
      phone: input.phone || null,
      address: input.address || null,
      departmentId: input.departmentId,
      designation: input.designation,
      employmentType: input.employmentType,
      joinDate: input.joinDate,
      payBasis: input.employmentType === "DAILY_WAGE" ? "DAILY" : "MONTHLY",
      bankAccount: input.bankAccount || null,
    });
    await recordAuditEvent({ actorId, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id, metadata: { employeeCode: input.employeeCode } });
    return getEmployee(employee.id, false);
  } catch (error) {
    if (isUnique(error)) throw new AppError("An employee with that code already exists.", { code: "EMPLOYEE_EXISTS", status: 409 });
    throw error;
  }
}

export async function updateEmployee(id: string, input: EmployeeUpdate, actorId: string) {
  if (!UUID.test(id)) employeeNotFound();
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) employeeNotFound();
  if (input.departmentId !== employee.departmentId) await requireActiveDepartment(input.departmentId);
  const leftDate = input.leftDate || null;
  await db.orm.public.Employee.where({ id }).update({
    name: input.name,
    fatherName: input.fatherName || null,
    nationalId: input.nationalId || null,
    phone: input.phone || null,
    address: input.address || null,
    departmentId: input.departmentId,
    designation: input.designation,
    employmentType: input.employmentType,
    joinDate: input.joinDate,
    leftDate,
    status: leftDate ? "LEFT" : "ACTIVE",
    bankAccount: input.bankAccount || null,
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({ actorId, action: leftDate && !employee.leftDate ? "EMPLOYEE_LEFT" : "EMPLOYEE_UPDATED", entityType: "Employee", entityId: id, metadata: { leftDate } });
  return getEmployee(id, false);
}

/* Pay rates: payroll:process only. Changes apply to runs calculated afterwards. */
export async function setEmployeePay(id: string, input: EmployeePay, actorId: string) {
  if (!UUID.test(id)) employeeNotFound();
  const employee = await db.orm.public.Employee.where({ id }).first();
  if (!employee) employeeNotFound();
  await db.orm.public.Employee.where({ id }).update({
    payBasis: input.payBasis,
    basicSalary: toPlainDecimalString(input.basicSalary),
    allowances: toPlainDecimalString(input.allowances),
    overtimeRate: toPlainDecimalString(input.overtimeRate),
    fixedDeduction: toPlainDecimalString(input.fixedDeduction),
    updatedAt: new Date().toISOString(),
  });
  await recordAuditEvent({
    actorId,
    action: "EMPLOYEE_PAY_CHANGED",
    entityType: "Employee",
    entityId: id,
    metadata: {
      before: { payBasis: employee.payBasis, basicSalary: dec(employee.basicSalary), allowances: dec(employee.allowances), overtimeRate: dec(employee.overtimeRate), fixedDeduction: dec(employee.fixedDeduction) },
      after: input,
    },
  });
  return getEmployee(id, true);
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export async function saveAttendance(input: AttendanceSave, actorId: string) {
  const period = input.date.slice(0, 7);
  const ids = [...new Set(input.records.map((record) => record.employeeId))];
  if (ids.length !== input.records.length) {
    throw new AppError("Each employee can appear once per day.", { code: "ATTENDANCE_DUPLICATE", status: 400 });
  }

  await db.transaction(async (tx) => {
    await lockPayrollPeriod(tx, period);
    const locked = await periodIsLocked(tx, period);
    if (locked) {
      throw new AppError(`Attendance for ${period} is locked: payroll ${locked} has been approved.`, { code: "ATTENDANCE_LOCKED", status: 409 });
    }
    const employees = await tx.orm.public.Employee.where((row) => row.id.in(ids)).all();
    for (const record of input.records) {
      const employee = employees.find((item) => item.id === record.employeeId);
      if (!employee) throw new AppError("An attendance record refers to an unknown employee.", { code: "EMPLOYEE_NOT_FOUND", status: 400 });
      if (!isEmployedOn(input.date, employee.joinDate, employee.leftDate)) {
        throw new AppError(`${employee.name} was not employed on ${input.date}.`, { code: "NOT_EMPLOYED_ON_DATE", status: 409 });
      }
      const hours = toPlainDecimalString(record.overtimeHours ?? 0);
      await tx.query(db.raw.sql`
        insert into erp_attendance_records ("id", "employeeId", "date", "status", "overtimeHours", "remarks", "recordedBy", "recordedAt")
        values (gen_random_uuid(), ${record.employeeId}::uuid, ${input.date}, ${record.status}, ${hours}::numeric, ${record.remarks ?? ""}, ${actorId}::uuid, now())
        on conflict ("employeeId", "date") do update set
          status = excluded.status, "overtimeHours" = excluded."overtimeHours", remarks = excluded.remarks,
          "recordedBy" = excluded."recordedBy", "recordedAt" = now()
        returning id::text as id
      `.returnsRow({ id: "pg/text@1" }).build() as never);
    }
    await recordAuditEvent({ actorId, action: "ATTENDANCE_SAVED", entityType: "Attendance", entityId: input.date, metadata: { records: input.records.length } }, tx);
  });

  return listAttendance({ date: input.date });
}

export async function listAttendance(filters: { date?: string; period?: string; employeeId?: string; departmentId?: string }) {
  let query = db.orm.public.AttendanceRecord;
  if (filters.date) query = query.where({ date: filters.date });
  if (filters.period) query = query.where((row) => row.date.like(`${filters.period}-%`));
  if (filters.employeeId) query = query.where({ employeeId: filters.employeeId });
  const records = await query.orderBy((row) => row.date.asc()).limit(5000).all();
  const period = filters.date?.slice(0, 7) ?? filters.period ?? null;
  return {
    records: records.map((record) => ({ ...record, overtimeHours: dec(record.overtimeHours) })),
    lockedBy: period ? await periodIsLocked(null, period) : null,
  };
}
