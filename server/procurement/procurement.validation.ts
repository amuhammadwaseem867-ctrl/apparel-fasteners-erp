import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.").refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date.");
const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(200).default(25);
const price = z.number().finite().min(0).max(100000000).refine((value) => toScaledDecimal(value).scale <= 6, "Use at most 6 decimal places.");
const money = z.number().finite().gt(0, "Must be greater than zero.").max(10000000000).refine((value) => toScaledDecimal(value).scale <= 2, "Use at most 2 decimal places.");
const percent = z.number().int().min(0).max(100);

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;

export const supplierInputSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9-]{2,20}$/, "Use 2–20 capital letters, digits or dashes."),
  name: z.string().trim().min(2).max(160),
  contactName: optionalTextSchema(120),
  phone: optionalTextSchema(40),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: optionalTextSchema(300),
  taxRegistration: optionalTextSchema(60),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: optionalTextSchema(1000),
});

export const supplierUpdateSchema = supplierInputSchema.omit({ code: true }).extend({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export const requisitionInputSchema = z.object({
  neededBy: date.optional().or(z.literal("")),
  notes: optionalTextSchema(1000),
  lines: z.array(z.object({ productId: uuid, quantity: quantitySchema(), notes: optionalTextSchema(300) })).max(200).default([]),
  plannedOrderIds: z.array(uuid).max(200).default([]),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  if (!input.lines.length && !input.plannedOrderIds.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Add at least one item, or choose confirmed MRP buy suggestions." });
  }
});

export const requisitionActionSchema = z.object({
  action: z.enum(["submit", "approve", "reject", "cancel"]),
  note: optionalTextSchema(500),
});

export const rfqInputSchema = z.object({
  requisitionId: uuid.optional(),
  responseDue: date.optional().or(z.literal("")),
  notes: optionalTextSchema(1000),
  lines: z.array(z.object({ productId: uuid, quantity: quantitySchema() })).max(200).default([]),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  if (!input.requisitionId && !input.lines.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Add items or choose an approved requisition." });
  }
});

export const quoteInputSchema = z.object({
  supplierId: uuid,
  quoteRef: optionalTextSchema(80),
  validUntil: date.optional().or(z.literal("")),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  taxPercent: percent.default(0),
  notes: optionalTextSchema(500),
  prices: z.array(z.object({ rfqLineId: uuid, unitPrice: price })).min(1).max(200),
});

export const awardSchema = z.object({ quoteId: uuid, idempotencyKey: idempotencyKeySchema });

const poLineSchema = z.object({
  productId: uuid,
  quantity: quantitySchema(),
  unitPrice: price,
  discountPercent: percent.default(0),
  taxPercent: percent.default(0),
  requisitionLineId: uuid.optional(),
});

export const purchaseOrderInputSchema = z.object({
  supplierId: uuid,
  orderDate: date,
  expectedDate: date.optional().or(z.literal("")),
  requisitionId: uuid.optional(),
  notes: optionalTextSchema(1000),
  lines: z.array(poLineSchema).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
});

export const purchaseOrderActionSchema = z.object({
  action: z.enum(["approve", "cancel", "close"]),
  reason: optionalTextSchema(500),
}).superRefine((input, context) => {
  if (input.action !== "approve" && !input.reason?.trim()) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Give a reason." });
  }
});

export const receiptInputSchema = z.object({
  purchaseOrderId: uuid,
  locationId: uuid,
  receivedDate: date,
  deliveryNoteRef: optionalTextSchema(80),
  qualityHold: z.boolean().default(false),
  notes: optionalTextSchema(500),
  lines: z.array(z.object({ purchaseOrderLineId: uuid, quantity: quantitySchema() })).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
});

export const billInputSchema = z.object({
  supplierId: uuid,
  purchaseOrderId: uuid.optional(),
  supplierInvoiceNumber: z.string().trim().min(1).max(60),
  billDate: date,
  dueDate: date.optional().or(z.literal("")),
  notes: optionalTextSchema(1000),
  lines: z.array(z.object({
    purchaseOrderLineId: uuid.optional(),
    description: optionalTextSchema(300),
    quantity: quantitySchema(),
    unitPrice: price.optional(),
    discountPercent: percent.optional(),
    taxPercent: percent.optional(),
  })).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  input.lines.forEach((line, index) => {
    if (!line.purchaseOrderLineId && (!line.description?.trim() || line.unitPrice === undefined)) {
      context.addIssue({ code: "custom", path: ["lines", index], message: "Lines without a PO line need a description and a price." });
    }
    if (line.purchaseOrderLineId && !input.purchaseOrderId) {
      context.addIssue({ code: "custom", path: ["lines", index], message: "Choose the purchase order for PO lines." });
    }
  });
});

export const billActionSchema = z.object({
  action: z.enum(["approve", "cancel"]),
  reason: optionalTextSchema(500),
}).superRefine((input, context) => {
  if (input.action === "cancel" && !input.reason?.trim()) context.addIssue({ code: "custom", path: ["reason"], message: "Give a reason." });
});

export const supplierPaymentInputSchema = z.object({
  billId: uuid,
  paymentDate: date,
  method: z.enum(PAYMENT_METHODS),
  reference: optionalTextSchema(120),
  amount: money,
  notes: optionalTextSchema(500),
  idempotencyKey: idempotencyKeySchema,
});

export const voidSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const listQuerySchema = z.object({
  status: z.string().trim().max(40).default(""),
  supplierId: uuid.optional().or(z.literal("")),
  search: z.string().trim().max(120).default(""),
  page,
  pageSize,
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>;
export type RequisitionInput = z.infer<typeof requisitionInputSchema>;
export type RfqInput = z.infer<typeof rfqInputSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;
export type ReceiptInput = z.infer<typeof receiptInputSchema>;
export type BillInput = z.infer<typeof billInputSchema>;
export type SupplierPaymentInput = z.infer<typeof supplierPaymentInputSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
