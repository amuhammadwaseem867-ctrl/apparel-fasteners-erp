import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema } from "../core/validation/quantity";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");
const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(200).default(25);

/* Non-negative money with at most 2 decimals. */
const money = z.number().finite().min(0).max(100000000).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.");

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "PAID_LEAVE", "UNPAID_LEAVE", "HOLIDAY", "WEEKLY_OFF"] as const;

export const departmentInputSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9-]{2,20}$/, "Use 2–20 capital letters, digits or dashes."),
  name: z.string().trim().min(2).max(80),
});

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const employeeFields = {
  name: z.string().trim().min(2).max(120),
  fatherName: optionalTextSchema(120),
  nationalId: optionalTextSchema(40),
  phone: optionalTextSchema(40),
  address: optionalTextSchema(300),
  departmentId: uuid,
  designation: z.string().trim().min(2).max(80),
  employmentType: z.enum(["PERMANENT", "CONTRACT", "DAILY_WAGE"]),
  joinDate: date,
  bankAccount: optionalTextSchema(60),
};

export const employeeInputSchema = z.object({
  employeeCode: z.string().trim().min(2).max(30),
  ...employeeFields,
});

export const employeeUpdateSchema = z.object({
  ...employeeFields,
  leftDate: date.optional().or(z.literal("")),
}).superRefine((input, context) => {
  if (input.leftDate && input.leftDate < input.joinDate) {
    context.addIssue({ code: "custom", path: ["leftDate"], message: "The leaving date cannot be before the joining date." });
  }
});

export const employeePaySchema = z.object({
  payBasis: z.enum(["MONTHLY", "DAILY"]),
  basicSalary: money,
  allowances: money,
  overtimeRate: money,
  fixedDeduction: money,
});

export const employeeQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  departmentId: uuid.optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "LEFT", ""]).default("ACTIVE"),
  page,
  pageSize,
});

export const attendanceSaveSchema = z.object({
  date,
  records: z.array(z.object({
    employeeId: uuid,
    status: z.enum(ATTENDANCE_STATUSES),
    overtimeHours: z.number().finite().min(0).max(24).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.").default(0),
    remarks: optionalTextSchema(200),
  })).min(1).max(500),
});

export const attendanceQuerySchema = z.object({
  date: date.optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  employeeId: uuid.optional(),
  departmentId: uuid.optional().or(z.literal("")),
});

export const advanceInputSchema = z.object({
  employeeId: uuid,
  issueDate: date,
  amount: money.refine((value) => value > 0, "Must be greater than zero."),
  installment: money.refine((value) => value > 0, "Must be greater than zero."),
  reason: z.string().trim().min(3).max(300),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  if (input.installment > input.amount) {
    context.addIssue({ code: "custom", path: ["installment"], message: "The instalment cannot exceed the advance." });
  }
});

export const payrollRunInputSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM."),
  notes: optionalTextSchema(500),
});

export const payrollActionSchema = z.object({
  action: z.enum(["recalculate", "approve", "pay", "cancel"]),
  paymentReference: optionalTextSchema(120),
});

export const payrollAdjustmentSchema = z.object({
  otherEarning: money.default(0),
  otherDeduction: money.default(0),
  adjustmentNote: optionalTextSchema(200),
});

export type EmployeeInput = z.infer<typeof employeeInputSchema>;
export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;
export type EmployeePay = z.infer<typeof employeePaySchema>;
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;
export type AttendanceSave = z.infer<typeof attendanceSaveSchema>;
export type AdvanceInput = z.infer<typeof advanceInputSchema>;
