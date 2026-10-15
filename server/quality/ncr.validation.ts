import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema } from "../core/validation/quantity";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");

export const NCR_SOURCES = ["INSPECTION", "IN_PROCESS", "CUSTOMER", "SUPPLIER", "INTERNAL"] as const;
export const NCR_DISPOSITIONS = ["REWORK", "SCRAP", "USE_AS_IS", "RETURN_TO_SUPPLIER", "REGRADE"] as const;

export const ncrInputSchema = z.object({
  source: z.enum(NCR_SOURCES),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(4000),
  productId: uuid.optional(),
  productionOrderId: uuid.optional(),
  inspectionId: uuid.optional(),
  supplierId: uuid.optional(),
  customerId: uuid.optional(),
  quantityAffected: z.number().finite().positive().max(1000000000).optional(),
  containment: optionalTextSchema(2000),
  idempotencyKey: idempotencyKeySchema,
});

export const ncrUpdateSchema = z.object({
  containment: optionalTextSchema(2000),
  rootCause: optionalTextSchema(4000),
  disposition: z.enum(NCR_DISPOSITIONS).optional().or(z.literal("")),
});

export const ncrActionSchema = z.object({
  action: z.enum(["investigate", "close", "cancel"]),
  note: optionalTextSchema(1000),
});

export const capaInputSchema = z.object({
  ncrId: uuid.optional(),
  actionType: z.enum(["CORRECTIVE", "PREVENTIVE"]),
  title: z.string().trim().min(3).max(160),
  action: z.string().trim().min(3).max(4000),
  ownerName: z.string().trim().min(2).max(120),
  dueDate: date,
  idempotencyKey: idempotencyKeySchema,
});

export const capaActionSchema = z.object({
  action: z.enum(["start", "complete", "verify", "reopen", "cancel"]),
  note: optionalTextSchema(2000),
}).superRefine((input, context) => {
  if (["complete", "verify", "reopen", "cancel"].includes(input.action) && !input.note?.trim()) {
    context.addIssue({ code: "custom", path: ["note"], message: "Add a note." });
  }
});

export const ncrQuerySchema = z.object({
  status: z.string().trim().max(20).default(""),
  severity: z.string().trim().max(20).default(""),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type NcrInput = z.infer<typeof ncrInputSchema>;
export type CapaInput = z.infer<typeof capaInputSchema>;
export type NcrQuery = z.infer<typeof ncrQuerySchema>;
