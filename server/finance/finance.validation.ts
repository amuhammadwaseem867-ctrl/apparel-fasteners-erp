import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";
import { orderSheetSchema } from "../sales/sales.validation";

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

export const INVOICE_TYPES = ["SALES_TAX", "NON_TAX"] as const;

export const invoiceInputSchema = z.object({
  shipmentId: uuid,
  /* SALES_TAX bills GST at the order's rates; NON_TAX bills no sales tax. */
  invoiceType: z.enum(INVOICE_TYPES).default("SALES_TAX"),
  invoiceDate: date,
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
});

/*
 * The invoice made first, by hand (D-048): the order sheet with a rate on
 * every line, sales tax (18%) or not, and payment terms. It becomes the
 * draft order and its draft invoice under one AF7-YY-NNNN number.
 */
export const SALES_TAX_PERCENT = 18;

export const manualInvoiceSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  invoiceType: z.enum(INVOICE_TYPES).default("SALES_TAX"),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  sheet: orderSheetSchema,
}).superRefine((input, context) => {
  input.sheet.lines.forEach((line, index) => {
    if (!(Number(line.unitPrice) > 0)) {
      context.addIssue({ code: "custom", path: ["sheet", "lines", index, "unitPrice"], message: `Line ${index + 1}: enter the rate.` });
    }
  });
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

/*
 * A receipt pays one issued invoice, or (no invoice, D-052) is an
 * installment on the customer's account: against the old balance or the
 * account as a whole.
 */
export const receiptInputSchema = z.object({
  invoiceId: uuid.optional().or(z.literal("")),
  customerId: uuid.optional().or(z.literal("")),
  receiptDate: date,
  method: z.enum(RECEIPT_METHODS),
  reference: optionalTextSchema(120),
  amount: money,
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
}).refine((input) => Boolean(input.invoiceId || input.customerId), { path: ["invoiceId"], message: "Choose the invoice or the customer the payment is from." });

/* The customer's balance from before the ERP (D-052). Zero clears it. */
export const openingBalanceSchema = z.object({
  amount: z.number().finite().min(0).max(10000000000).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places."),
  date,
  notes: optionalTextSchema(500),
});

export const ledgerQuerySchema = z.object({
  from: date.optional().or(z.literal("")),
  to: date.optional().or(z.literal("")),
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
  customerId: uuid.optional().or(z.literal("")),
  search: z.string().trim().max(120).default(""),
  page,
  pageSize,
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type ManualInvoiceInput = z.infer<typeof manualInvoiceSchema>;
export type CreditNoteInput = z.infer<typeof creditNoteInputSchema>;
export type ReceiptInput = z.infer<typeof receiptInputSchema>;
export type OpeningBalanceInput = z.infer<typeof openingBalanceSchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
export type ReceiptQuery = z.infer<typeof receiptQuerySchema>;
