import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema } from "../core/validation/quantity";
import { ACCOUNT_TYPES } from "./ledger-rules";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");
const optionalDate = date.optional().or(z.literal("")).default("");
const amount = z.number().finite().min(0).max(100000000000).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.");

export const accountInputSchema = z.object({
  code: z.string().trim().regex(/^[0-9A-Z-]{2,12}$/, "Use 2–12 digits, capital letters or dashes."),
  name: z.string().trim().min(2).max(120),
  accountType: z.enum(ACCOUNT_TYPES),
  isCashBank: z.boolean().default(false),
  description: optionalTextSchema(300),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalTextSchema(300),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const journalInputSchema = z.object({
  entryDate: date,
  description: z.string().trim().min(3).max(300),
  lines: z.array(z.object({ accountId: z.string().uuid(), debit: amount.default(0), credit: amount.default(0), memo: optionalTextSchema(200) })).min(2).max(100),
  idempotencyKey: idempotencyKeySchema,
});

export const reverseSchema = z.object({ entryDate: date, reason: z.string().trim().min(3).max(300) });

export const cashTransactionInputSchema = z.object({
  kind: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  transactionDate: date,
  cashAccountId: z.string().uuid(),
  counterAccountId: z.string().uuid(),
  amount: amount.refine((value) => value > 0, "Must be greater than zero."),
  payee: optionalTextSchema(160),
  reference: optionalTextSchema(120),
  description: z.string().trim().min(3).max(300),
  idempotencyKey: idempotencyKeySchema,
});

export const voidSchema = z.object({ reason: z.string().trim().min(3).max(300) });

const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(200).default(25);

export const journalQuerySchema = z.object({ from: optionalDate, to: optionalDate, search: z.string().trim().max(120).default(""), source: z.string().trim().max(40).default(""), page, pageSize });
export const cashQuerySchema = z.object({ kind: z.enum(["EXPENSE", "INCOME", "TRANSFER", ""]).default(""), from: optionalDate, to: optionalDate, search: z.string().trim().max(120).default(""), page, pageSize });
export const asOfQuerySchema = z.object({ asOf: optionalDate });
export const rangeQuerySchema = z.object({ from: optionalDate, to: optionalDate });
