import { z } from "zod";

import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();

/* A line ships one confirmed packing list, or loose stock of one item. */
const shipmentLineSchema = z
  .object({
    packingListId: uuid.optional(),
    productId: uuid.optional(),
    quantity: quantitySchema().optional(),
  })
  .superRefine((line, context) => {
    const packed = Boolean(line.packingListId);
    const loose = Boolean(line.productId) || line.quantity !== undefined;
    if (packed === loose || (loose && (!line.productId || line.quantity === undefined))) {
      context.addIssue({ code: "custom", message: "Each line needs either a packing list, or an item and quantity." });
    }
  });

export const shipmentInputSchema = z.object({
  salesOrderId: uuid,
  locationId: uuid,
  lines: z.array(shipmentLineSchema).min(1).max(200),
  vehicleNumber: optionalTextSchema(40),
  driverName: optionalTextSchema(120),
  driverPhone: optionalTextSchema(40),
  transporter: optionalTextSchema(120),
  trackingReference: optionalTextSchema(120),
  deliveryAddress: optionalTextSchema(500),
  notes: optionalTextSchema(1000),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((input, context) => {
  const ids = input.lines.map((line) => line.packingListId).filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "A packing list can only be on a shipment once." });
  }
});

export const shipmentActionSchema = z.object({
  action: z.enum(["dispatch", "deliver", "cancel"]),
  receivedBy: optionalTextSchema(120),
  deliveryNote: optionalTextSchema(500),
}).superRefine((input, context) => {
  if (input.action === "deliver" && !input.receivedBy?.trim()) {
    context.addIssue({ code: "custom", path: ["receivedBy"], message: "Enter who received the delivery." });
  }
});

export const shipmentQuerySchema = z.object({
  status: z.enum(["DRAFT", "DISPATCHED", "DELIVERED", "CANCELLED", "OPEN", ""]).default(""),
  salesOrderId: uuid.optional().or(z.literal("")),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ShipmentInput = z.infer<typeof shipmentInputSchema>;
export type ShipmentQuery = z.infer<typeof shipmentQuerySchema>;
