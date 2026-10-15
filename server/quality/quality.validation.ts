import { z } from "zod";

import { addDecimalStrings, compareDecimalStrings, toPlainDecimalString } from "../core/utils/decimal";
import { idempotencyKeySchema, optionalTextSchema, quantitySchema } from "../core/validation/quantity";

const uuid = z.string().uuid();

export const INSPECTION_TYPES = ["INCOMING", "IN_PROCESS", "FINAL"] as const;

const defectSchema = z.object({
  description: z.string().trim().min(1).max(200),
  count: z.number().int().min(1).max(1000000000),
});

/*
 * INCOMING: stock held under QC at one location (productId + locationId).
 * IN_PROCESS: a sampling check at a production stage (productionOrderId +
 * stageKey); it records results and defects only.
 * FINAL: the production order's quality-check stage (productionOrderId);
 * approval records that stage's run.
 */
export const inspectionInputSchema = z
  .object({
    inspectionType: z.enum(INSPECTION_TYPES),
    productId: uuid.optional(),
    productionOrderId: uuid.optional(),
    stageKey: z.string().trim().max(40).optional().or(z.literal("")),
    locationId: uuid.optional(),
    inspectedQuantity: quantitySchema(),
    passedQuantity: quantitySchema(true),
    reworkQuantity: quantitySchema(true).default(0),
    rejectedQuantity: quantitySchema(true).default(0),
    sampleSize: z.number().int().min(1).max(1000000000).optional(),
    defects: z.array(defectSchema).max(50).default([]),
    inspectorName: optionalTextSchema(120),
    remarks: optionalTextSchema(1000),
    idempotencyKey: idempotencyKeySchema,
  })
  .superRefine((input, context) => {
    const parts = [input.passedQuantity, input.reworkQuantity, input.rejectedQuantity]
      .map((value) => toPlainDecimalString(value ?? 0))
      .reduce((sum, value) => addDecimalStrings(sum, value), "0");

    if (compareDecimalStrings(parts, toPlainDecimalString(input.inspectedQuantity)) !== 0) {
      context.addIssue({ code: "custom", path: ["inspectedQuantity"], message: "Passed + rework + rejected must equal the inspected quantity." });
    }

    if (input.inspectionType === "INCOMING") {
      if (!input.productId) context.addIssue({ code: "custom", path: ["productId"], message: "Choose the item to inspect." });
      if (!input.locationId) context.addIssue({ code: "custom", path: ["locationId"], message: "Choose the location holding the stock." });
    } else {
      if (!input.productionOrderId) context.addIssue({ code: "custom", path: ["productionOrderId"], message: "Choose the production order." });
      if (input.inspectionType === "IN_PROCESS" && !input.stageKey) {
        context.addIssue({ code: "custom", path: ["stageKey"], message: "Choose the stage inspected." });
      }
    }
  });

export const inspectionDecisionSchema = z.object({
  action: z.enum(["approve", "cancel"]),
  note: optionalTextSchema(500),
});

export const inspectionQuerySchema = z.object({
  inspectionType: z.enum([...INSPECTION_TYPES, ""]).default(""),
  status: z.enum(["OPEN", "APPROVED", "CANCELLED", ""]).default(""),
  productionOrderId: uuid.optional().or(z.literal("")),
  failedOnly: z.enum(["true", "false", ""]).default(""),
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type InspectionInput = z.infer<typeof inspectionInputSchema>;
export type InspectionQuery = z.infer<typeof inspectionQuerySchema>;
