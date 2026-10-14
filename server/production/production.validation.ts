import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { STAGES } from "./production-rules";

const uuid = z.string().uuid();
const quantity = (allowZero: boolean) => z
  .number()
  .finite()
  .min(0)
  .max(1000000000)
  .refine((value) => allowZero || value > 0, "Must be greater than zero.")
  .refine((value) => toScaledDecimal(value).scale <= 6, "Too many decimal places.");

export const productionOrderInputSchema = z.object({
  productId: uuid,
  quantity: quantity(false),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  salesOrderId: uuid.optional(),
  salesOrderLineId: uuid.optional(),
  plannedOrderId: uuid.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const productionActionSchema = z.object({
  action: z.enum(["release", "hold", "resume", "cancel"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const stageRunInputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  inputQuantity: quantity(false),
  acceptedQuantity: quantity(true),
  rejectedQuantity: quantity(true).default(0),
  wastageQuantity: quantity(true).default(0),
  reworkQuantity: quantity(true).default(0),
  operatorName: z.string().trim().max(120).optional().or(z.literal("")),
  workstation: z.string().trim().max(120).optional().or(z.literal("")),
  remarks: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const stageKeySchema = z.enum(STAGES.map((stage) => stage.key) as [string, ...string[]]);

export const productionQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["PLANNED", "RELEASED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ACTIVE", "OPEN", ""]).default(""),
  sort: z.enum(["created", "due"]).default("created"),
  stage: z.string().trim().max(40).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ProductionOrderInput = z.infer<typeof productionOrderInputSchema>;
export type StageRunInput = z.infer<typeof stageRunInputSchema>;
export type ProductionQuery = z.infer<typeof productionQuerySchema>;
