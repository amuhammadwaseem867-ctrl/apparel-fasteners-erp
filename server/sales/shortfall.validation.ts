import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();

export const shortfallReasons = [
  "PRODUCTION_SHORT",
  "MATERIAL_SHORT",
  "QC_REJECTED",
  "CUSTOMER_REQUEST",
  "OTHER",
] as const;

export const shortfallInputSchema = z.object({
  salesOrderId: uuid,
  salesOrderLineId: uuid.optional().or(z.literal("")),
  productId: uuid.optional().or(z.literal("")),
  quantity: quantitySchema(),
  reason: z.enum(shortfallReasons),
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
});

export const shortfallResolveSchema = z.object({
  quantity: quantitySchema().optional(),
});

/* PATCH on one shortfall: resolve (optionally partly) or cancel. */
export const shortfallActionSchema = z.object({
  action: z.enum(["resolve", "cancel"]).default("resolve"),
  quantity: quantitySchema().optional(),
});

export const shortfallQuerySchema = z.object({
  salesOrderId: uuid.optional().or(z.literal("")),
  status: z.enum(["OPEN", "RESOLVED", "CANCELLED", ""]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ShortfallInput = z.infer<typeof shortfallInputSchema>;
export type ShortfallResolve = z.infer<typeof shortfallResolveSchema>;
