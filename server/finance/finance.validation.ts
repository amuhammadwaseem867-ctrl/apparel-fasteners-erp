import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");
const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);

/* A positive money amount in whole cents. */
const money = z
  .number()
  .finite()
  .gt(0, "Must be greater than zero.")
  .max(10000000000)
  .refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.");

export const RECEIPT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;

export const invoiceInputSchema = z.object({
  shipmentId: uuid,
  invoiceDate: date,
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
});

export const invoiceActionSchema = z.object({
  action: z.enum(["issue", "cancel"]),
  reason: optionalTextSchema(500),
}).superRefine((input, context) => {
  if (input.action === "cancel" && !input.reason?.trim()) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for cancelling the invoice." });
  }
});

export const creditNoteInputSchema = z.object({
  invoiceId: uuid,
  creditDate: date,
  reason: z.string().trim().min(3).max(500),
  lines: z.array(z.object({ invoiceLineId: uuid, quantity: quantitySchema() })).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  const ids = input.lines.map((line) => line.invoiceLineId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Each invoice line can appear once." });
  }
});

export const receiptInputSchema = z.object({
  invoiceId: uuid,
  receiptDate: date,
  method: z.enum(RECEIPT_METHODS),
  reference: optionalTextSchema(120),
  amount: money,
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
});

export const voidReceiptSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const invoiceQuerySchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED", ""]).default(""),
  balance: z.enum(["open", "overdue", "paid", ""]).default(""),
  customerId: uuid.optional().or(z.literal("")),
  salesOrderId: uuid.optional().or(z.literal("")),
  search: z.string().trim().max(120).default(""),
  page,
  pageSize,
});

export const receiptQuerySchema = z.object({
  status: z.enum(["POSTED", "VOIDED", ""]).default(""),
  search: z.string().trim().max(120).default(""),
  page,
  pageSize,
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type CreditNoteInput = z.infer<typeof creditNoteInputSchema>;
export type ReceiptInput = z.infer<typeof receiptInputSchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
export type ReceiptQuery = z.infer<typeof receiptQuerySchema>;
