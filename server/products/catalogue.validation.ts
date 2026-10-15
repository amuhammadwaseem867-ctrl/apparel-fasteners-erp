import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { optionalTextSchema } from "../core/validation/quantity";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");

export const categoryInputSchema = z.object({ name: z.string().trim().min(2).max(80), description: optionalTextSchema(300) });
export const categoryUpdateSchema = categoryInputSchema.extend({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export const priceChangeSchema = z.object({
  productId: z.string().uuid(),
  unitPrice: z.number().finite().min(0).max(100000000).refine((value) => toScaledDecimal(value).scale <= 6, "Use at most 6 decimal places."),
  effectiveDate: date,
  reason: z.string().trim().min(3).max(300),
});

export const bulkPriceSchema = z.object({
  category: z.string().trim().min(1).max(80),
  percent: z.number().finite().min(-90).max(500).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.").refine((value) => value !== 0, "Enter a change."),
  effectiveDate: date,
  reason: z.string().trim().min(3).max(300),
  apply: z.boolean().default(false),
});

export const catalogueQuerySchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  status: z.string().trim().max(20).default(""),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
