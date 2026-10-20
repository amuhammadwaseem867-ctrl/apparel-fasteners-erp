import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";

const MAX_PRICE_DECIMALS = 6;

function optionalText(max: number) {
  return z.string().trim().max(max).optional().or(z.literal(""));
}

const productFields = {
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(120),
  productType: z.string().trim().min(1).max(80),
  variant: z.string().trim().max(180).optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(40),
  unitPrice: z
    .number()
    .finite()
    .min(0)
    .max(100000000)
    .refine(
      (value) => toScaledDecimal(value).scale <= MAX_PRICE_DECIMALS,
      `Unit price can have at most ${MAX_PRICE_DECIMALS} decimal places.`,
    ),
  status: z.enum(["ACTIVE", "INACTIVE"]),

  // Item master specification. Each distinct combination is its own SKU.
  size: optionalText(60),
  material: optionalText(80),
  itemType: optionalText(80),
  finish: optionalText(80),
  color: optionalText(80),
  logoType: optionalText(40),
  barcode: optionalText(120),
  minimumStock: z
    .number()
    .finite()
    .min(0)
    .max(100000000)
    .refine(
      (value) => toScaledDecimal(value).scale <= 3,
      "Minimum stock can have at most 3 decimal places.",
    )
    .default(0),
  /* Grams per piece; lets stock show in pieces and kg. Empty = unknown. */
  unitWeightGrams: z
    .number()
    .finite()
    .positive("Unit weight must be more than zero.")
    .max(1000000)
    .refine((value) => toScaledDecimal(value).scale <= 4, "Unit weight can have at most 4 decimal places.")
    .nullable()
    .optional(),
};

export const productInputSchema = z.object(productFields);

export const productQuerySchema = z.object({
  search: z.string().trim().max(180).default(""),
  category: z.string().trim().max(120).default(""),
  productType: z.string().trim().max(80).default(""),
  variant: z.string().trim().max(180).default(""),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", ""]).default(""),
  size: z.string().trim().max(60).default(""),
  material: z.string().trim().max(80).default(""),
  finish: z.string().trim().max(80).default(""),
  logoType: z.string().trim().max(40).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
