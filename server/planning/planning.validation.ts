import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";

const uuid = z.string().uuid();

const bomLineSchema = z.object({
  componentId: uuid,
  quantity: z.number().finite().positive().max(1000000)
    .refine((value) => toScaledDecimal(value).scale <= 6, "Quantity can have at most 6 decimal places."),
  scrapPercent: z.number().finite().min(0).lt(100)
    .refine((value) => toScaledDecimal(value).scale <= 3, "Scrap can have at most 3 decimal places.")
    .default(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const bomFields = {
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lines: z.array(bomLineSchema).min(1).max(200),
};

function uniqueComponents(input: { lines: Array<{ componentId: string }> }, context: z.RefinementCtx) {
  const ids = input.lines.map((line) => line.componentId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "List each component once." });
  }
}

export const bomInputSchema = z
  .object({ productId: uuid, ...bomFields })
  .superRefine((input, context) => {
    uniqueComponents(input, context);
    if (input.lines.some((line) => line.componentId === input.productId)) {
      context.addIssue({ code: "custom", path: ["lines"], message: "An item cannot be a component of itself." });
    }
  });

export const bomUpdateSchema = z.object(bomFields).superRefine(uniqueComponents);

export const bomActionSchema = z.object({
  action: z.enum(["approve", "activate", "obsolete", "revise"]),
});

export const bomQuerySchema = z.object({
  productId: uuid.optional().or(z.literal("")),
  status: z.enum(["DRAFT", "APPROVED", "OBSOLETE", ""]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const mrpRunInputSchema = z.object({
  /* Only approved orders with a delivery date on or before this date
   * (orders without a delivery date are always included). */
  horizonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export type BomInput = z.infer<typeof bomInputSchema>;
export type BomUpdate = z.infer<typeof bomUpdateSchema>;
export type BomQuery = z.infer<typeof bomQuerySchema>;
export type MrpRunInput = z.infer<typeof mrpRunInputSchema>;
