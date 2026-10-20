import { z } from "zod";

import { toScaledDecimal } from "../core/utils/decimal";
import { STOCK_DOCUMENT_TYPE_KEYS, documentTypeRule } from "./stock-rules";

const uuid = z.string().uuid();
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* Positive quantity, at most 6 decimals here; unit precision is checked
 * against each product's unit in the service. */
const quantity = z
  .number()
  .finite()
  .positive()
  .max(1000000000)
  .refine((value) => toScaledDecimal(value).scale <= 6, "Too many decimal places.");

/* Client-generated per submission (a UUID is ideal). Retrying the same
 * submission with the same key returns the original document. */
const idempotencyKey = z.string().trim().min(8).max(100);

const status = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const warehouseInputSchema = z.object({
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore."),
  name: z.string().trim().min(1).max(120),
  warehouseType: z.enum(["GENERAL", "RAW_MATERIAL", "WIP", "FINISHED_GOODS", "QUARANTINE", "SCRAP"]).default("GENERAL"),
  address: optionalText(500),
});

export const warehouseUpdateSchema = warehouseInputSchema.omit({ code: true });

export const statusChangeSchema = z.object({ status });

export const locationInputSchema = z.object({
  warehouseId: uuid,
  code: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore."),
  name: z.string().trim().min(1).max(120),
});

export const locationUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const documentLineSchema = z.object({
  productId: uuid,
  locationId: uuid,
  /* Transfers only: where the stock goes. */
  toLocationId: uuid.optional(),
  /* Positive for every type except ADJUSTMENT (signed) and COUNT (counted
   * quantity, which may be zero). */
  quantity: z.number().finite().min(-1000000000).max(1000000000)
    .refine((value) => toScaledDecimal(value).scale <= 6, "Too many decimal places."),
  /* MATERIAL_ISSUE / FG_DISPATCH: consume this reservation. */
  reservationId: uuid.optional(),
});

export const stockDocumentInputSchema = z
  .object({
    documentType: z.enum(STOCK_DOCUMENT_TYPE_KEYS as [string, ...string[]]),
    idempotencyKey,
    reference: optionalText(120),
    reason: optionalText(500),
    notes: optionalText(2000),
    sourceType: optionalText(60),
    sourceId: optionalText(120),
    lines: z.array(documentLineSchema).min(1).max(200),
  })
  .superRefine((input, context) => {
    const rule = documentTypeRule(input.documentType);

    if ("requiresReason" in rule && rule.requiresReason && !input.reason?.trim()) {
      context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required for this transaction." });
    }

    input.lines.forEach((line, index) => {
      const path = ["lines", index];

      if (input.documentType === "COUNT") {
        if (line.quantity < 0) {
          context.addIssue({ code: "custom", path: [...path, "quantity"], message: "Counted quantity cannot be negative." });
        }
      } else if (input.documentType === "ADJUSTMENT") {
        if (line.quantity === 0) {
          context.addIssue({ code: "custom", path: [...path, "quantity"], message: "Adjustment quantity cannot be zero." });
        }
      } else if (line.quantity <= 0) {
        context.addIssue({ code: "custom", path: [...path, "quantity"], message: "Quantity must be greater than zero." });
      }

      if (input.documentType === "TRANSFER") {
        if (!line.toLocationId) {
          context.addIssue({ code: "custom", path: [...path, "toLocationId"], message: "Choose the destination location." });
        } else if (line.toLocationId === line.locationId) {
          context.addIssue({ code: "custom", path: [...path, "toLocationId"], message: "Destination must differ from the source location." });
        }
      } else if (line.toLocationId) {
        context.addIssue({ code: "custom", path: [...path, "toLocationId"], message: "Only transfers have a destination location." });
      }

      if (line.reservationId && !("allowsReservation" in rule && rule.allowsReservation)) {
        context.addIssue({ code: "custom", path: [...path, "reservationId"], message: "Only issues and dispatches can consume a reservation." });
      }
    });

    if (input.documentType === "COUNT") {
      const keys = input.lines.map((line) => `${line.productId}:${line.locationId}`);
      if (new Set(keys).size !== keys.length) {
        context.addIssue({ code: "custom", path: ["lines"], message: "Count each item and location only once per document." });
      }
    }
  });

export const reservationInputSchema = z.object({
  idempotencyKey,
  productId: uuid,
  locationId: uuid,
  quantity,
  salesOrderId: uuid.optional(),
  salesOrderLineId: uuid.optional(),
  notes: optionalText(1000),
});

export const reservationReleaseSchema = z.object({
  idempotencyKey,
  /* Omit to release everything still open on the reservation. */
  quantity: quantity.optional(),
  notes: optionalText(1000),
});

const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);
const optionalUuidParam = uuid.optional().or(z.literal(""));

export const warehouseQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", ""]).default(""),
});

export const locationQuerySchema = z.object({
  warehouseId: optionalUuidParam,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", ""]).default(""),
});

export const balanceQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  warehouseId: optionalUuidParam,
  warehouseType: z.enum(["GENERAL", "RAW_MATERIAL", "WIP", "FINISHED_GOODS", "QUARANTINE", "SCRAP", ""]).default(""),
  locationId: optionalUuidParam,
  productId: optionalUuidParam,
  page,
  pageSize,
});

export const movementQuerySchema = z.object({
  productId: optionalUuidParam,
  locationId: optionalUuidParam,
  documentType: z.string().trim().max(40).default(""),
  dateFrom: dateString.optional().or(z.literal("")),
  dateTo: dateString.optional().or(z.literal("")),
  page,
  pageSize,
});

export const documentQuerySchema = z.object({
  documentType: z.string().trim().max(200).regex(/^[A-Z_,]*$/, "Use document type codes.").default(""),
  search: z.string().trim().max(120).default(""),
  dateFrom: dateString.optional().or(z.literal("")),
  dateTo: dateString.optional().or(z.literal("")),
  page,
  pageSize,
});

export const reservationQuerySchema = z.object({
  productId: optionalUuidParam,
  salesOrderId: optionalUuidParam,
  status: z.enum(["ACTIVE", "RELEASED", "CONSUMED", ""]).default(""),
  page,
  pageSize,
});

export type WarehouseInput = z.infer<typeof warehouseInputSchema>;
export type WarehouseUpdate = z.infer<typeof warehouseUpdateSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;
export type StockDocumentInput = z.infer<typeof stockDocumentInputSchema>;
export type ReservationInput = z.infer<typeof reservationInputSchema>;
export type ReservationRelease = z.infer<typeof reservationReleaseSchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
export type MovementQuery = z.infer<typeof movementQuerySchema>;
export type DocumentQuery = z.infer<typeof documentQuerySchema>;
export type ReservationQuery = z.infer<typeof reservationQuerySchema>;

export const rawMaterialQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  category: z.string().trim().max(120).default(""),
  /* Finished products are left out of the stock list unless asked for. */
  includeProducts: z.enum(["true", "false", ""]).default("").transform((value) => value === "true"),
  stock: z.enum(["", "OK", "LOW", "OUT", "ALERT"]).default(""),
});

export const stockCardQuerySchema = z.object({
  dateFrom: dateString.optional().or(z.literal("")),
  dateTo: dateString.optional().or(z.literal("")),
});
