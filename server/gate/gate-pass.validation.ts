import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const GATE_PASS_TYPES = ["INWARD", "OUTWARD_NON_RETURNABLE", "OUTWARD_RETURNABLE"] as const;

export const gatePassInputSchema = z.object({
  passType: z.enum(GATE_PASS_TYPES),
  partyName: z.string().trim().min(2).max(160),
  purpose: z.string().trim().min(3).max(500),
  shipmentId: uuid.optional(),
  vehicleNumber: optionalTextSchema(40),
  driverName: optionalTextSchema(120),
  referenceNo: optionalTextSchema(80),
  expectedReturnDate: date.optional().or(z.literal("")),
  notes: optionalTextSchema(1000),
  lines: z.array(z.object({
    productId: uuid.optional(),
    description: z.string().trim().min(1).max(300),
    unit: z.string().trim().min(1).max(20),
    quantity: quantitySchema(),
    bags: z.number().int().min(0).max(1000000).optional(),
    netWeight: quantitySchema(true).optional(),
    grossWeight: quantitySchema(true).optional(),
  })).max(200).default([]),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  if (input.passType === "OUTWARD_RETURNABLE" && !input.expectedReturnDate) {
    context.addIssue({ code: "custom", path: ["expectedReturnDate"], message: "A returnable pass needs an expected return date." });
  }
  if (input.passType === "INWARD" && input.shipmentId) {
    context.addIssue({ code: "custom", path: ["shipmentId"], message: "Only outward passes can be linked to a shipment." });
  }
  if (!input.shipmentId && input.lines.length === 0) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Add at least one line." });
  }
});

export const gatePassActionSchema = z.object({
  action: z.enum(["approve", "pass", "cancel"]),
  guardName: optionalTextSchema(120),
  reason: optionalTextSchema(500),
}).superRefine((input, context) => {
  if (input.action === "pass" && !input.guardName?.trim()) {
    context.addIssue({ code: "custom", path: ["guardName"], message: "Enter the guard recording the movement." });
  }
  if (input.action === "cancel" && !input.reason?.trim()) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for cancelling." });
  }
});

export const gatePassReturnSchema = z.object({
  lines: z.array(z.object({ lineId: uuid, quantity: quantitySchema() })).min(1).max(200),
});

export const gatePassQuerySchema = z.object({
  status: z.enum(["DRAFT", "APPROVED", "OUT", "COMPLETED", "CANCELLED", "OPEN", ""]).default(""),
  passType: z.enum([...GATE_PASS_TYPES, ""]).default(""),
  overdue: z.enum(["true", ""]).default(""),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type GatePassInput = z.infer<typeof gatePassInputSchema>;
export type GatePassQuery = z.infer<typeof gatePassQuerySchema>;
