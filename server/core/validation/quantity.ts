import { z } from "zod";

import { toScaledDecimal } from "../utils/decimal";

/* A finite quantity with at most 6 decimals; zero allowed only when asked. */
export function quantitySchema(allowZero = false) {
  return z
    .number()
    .finite()
    .min(0)
    .max(1000000000)
    .refine((value) => allowZero || value > 0, "Must be greater than zero.")
    .refine((value) => toScaledDecimal(value).scale <= 6, "Too many decimal places.");
}

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

export const optionalTextSchema = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
