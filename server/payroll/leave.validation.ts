import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema } from "../core/validation/quantity";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");

export const shiftInputSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9-]{1,12}$/, "Use 1–12 capital letters, digits or dashes."),
  name: z.string().trim().min(2).max(80),
  startTime: time,
  endTime: time,
  breakMinutes: z.number().int().min(0).max(240).default(0),
}).refine((input) => input.startTime !== input.endTime, { message: "Start and end must differ.", path: ["endTime"] });

export const shiftUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startTime: time,
  endTime: time,
  breakMinutes: z.number().int().min(0).max(240),
  status: z.enum(["ACTIVE", "INACTIVE"]),
}).refine((input) => input.startTime !== input.endTime, { message: "Start and end must differ.", path: ["endTime"] });

export const shiftAssignSchema = z.object({ employeeIds: z.array(z.string().uuid()).min(1).max(500), shiftId: z.string().uuid().nullable() });

export const leaveTypeInputSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9-]{1,12}$/, "Use 1–12 capital letters, digits or dashes."),
  name: z.string().trim().min(2).max(80),
  paid: z.boolean(),
  annualDays: z.number().min(0).max(366).multipleOf(0.5).default(0),
});

export const leaveTypeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  annualDays: z.number().min(0).max(366).multipleOf(0.5),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const leaveRequestInputSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  fromDate: date,
  toDate: date,
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: idempotencyKeySchema,
}).refine((input) => input.toDate >= input.fromDate, { message: "The end date is before the start date.", path: ["toDate"] })
  .refine((input) => (Date.parse(input.toDate) - Date.parse(input.fromDate)) / 86400000 <= 90, { message: "A request can cover at most 91 days.", path: ["toDate"] });

export const leaveActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  note: optionalTextSchema(500),
});

export const leaveQuerySchema = z.object({
  status: z.string().trim().max(20).default(""),
  employeeId: z.string().uuid().optional().or(z.literal("")),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type LeaveRequestInput = z.infer<typeof leaveRequestInputSchema>;
