import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();

export const PACKAGE_TYPES = ["Carton", "Polybag", "Bundle", "Box", "Bag", "Roll"] as const;

const packageSchema = z.object({
  packageType: z.enum(PACKAGE_TYPES),
  quantity: quantitySchema(),
  netWeight: quantitySchema(true).optional(),
  grossWeight: quantitySchema(true).optional(),
  dimensions: optionalTextSchema(60),
  marks: optionalTextSchema(200),
  /* AF7 packing list row: description, size and number of bags / cartons. */
  description: optionalTextSchema(200),
  size: optionalTextSchema(60),
  bags: z.number().int().min(1).max(100000).default(1),
});

export const packingListInputSchema = z.object({
  productionOrderId: uuid,
  locationId: uuid,
  /* Pass the packing step now: create and confirm in one transaction. */
  confirm: z.boolean().default(false),
  packages: z.array(packageSchema).min(1).max(500),
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  input.packages.forEach((item, index) => {
    if (item.netWeight !== undefined && item.grossWeight !== undefined && item.grossWeight < item.netWeight) {
      context.addIssue({ code: "custom", path: ["packages", index, "grossWeight"], message: "Gross weight cannot be less than net weight." });
    }
  });
});

export const packingActionSchema = z.object({
  action: z.enum(["confirm", "cancel"]),
});

export const packingQuerySchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "SHIPPED", "CANCELLED", "OPEN", ""]).default(""),
  productionOrderId: uuid.optional().or(z.literal("")),
  salesOrderId: uuid.optional().or(z.literal("")),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type PackingListInput = z.infer<typeof packingListInputSchema>;
export type PackingQuery = z.infer<typeof packingQuerySchema>;

