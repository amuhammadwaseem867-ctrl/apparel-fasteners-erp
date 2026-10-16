import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");

export const workCenterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  dailyCapacity: z.number().finite().positive().max(100000000),
  capacityUnit: z.string().trim().min(1).max(20),
  shiftsPerDay: z.number().int().min(1).max(3),
  notes: optionalTextSchema(300),
});

export const calendarDaySchema = z.object({ date, dayType: z.enum(["HOLIDAY", "SHUTDOWN", "WORKING"]), note: optionalTextSchema(120) });
export const calendarQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(), date: date.optional(), horizon: z.coerce.number().int().min(7).max(180).default(30) });

const planLine = z.object({ productId: z.string().uuid(), quantity: quantitySchema(), dueDate: date, priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), notes: optionalTextSchema(300) });

export const planInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  periodStart: date,
  periodEnd: date,
  notes: optionalTextSchema(1000),
  lines: z.array(planLine).max(300).default([]),
  idempotencyKey: idempotencyKeySchema,
}).refine((input) => input.periodEnd >= input.periodStart, { message: "The period ends before it starts.", path: ["periodEnd"] });

export const planUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  periodStart: date,
  periodEnd: date,
  notes: optionalTextSchema(1000),
  lines: z.array(planLine).max(300),
}).refine((input) => input.periodEnd >= input.periodStart, { message: "The period ends before it starts.", path: ["periodEnd"] });

export const planActionSchema = z.object({
  action: z.enum(["approve", "close", "cancel", "release-line", "cancel-line"]),
  lineId: z.string().uuid().optional(),
}).refine((input) => !input.action.endsWith("-line") || input.lineId, { message: "Choose the line.", path: ["lineId"] });

export const listSchema = z.object({ status: z.string().trim().max(20).default(""), search: z.string().trim().max(120).default(""), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(25) });

export const instructionInputSchema = z.object({
  productId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  packType: z.string().trim().min(2).max(60),
  unitsPerPack: quantitySchema(),
  packsPerCarton: z.number().int().min(1).max(100000),
  cartonType: optionalTextSchema(80),
  labelling: optionalTextSchema(500),
  instructions: optionalTextSchema(2000),
});
export const instructionUpdateSchema = instructionInputSchema.omit({ productId: true, customerId: true }).extend({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export const batchInputSchema = z.object({
  productId: z.string().uuid(),
  sourceType: z.enum(["PRODUCTION", "PURCHASE", "OPENING"]),
  productionOrderId: z.string().uuid().optional(),
  purchaseReceiptId: z.string().uuid().optional(),
  supplierLotRef: optionalTextSchema(60),
  quantity: quantitySchema(),
  madeOn: date,
  expiresOn: date.optional().or(z.literal("")),
  notes: optionalTextSchema(500),
});
export const batchStatusSchema = z.object({ status: z.enum(["ON_HOLD", "RELEASED", "REJECTED", "CONSUMED"]), note: optionalTextSchema(300) });
