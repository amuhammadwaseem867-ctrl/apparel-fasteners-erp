import { z } from "zod";

import {
  MAX_SAFE_CENTS,
  divideRoundHalfUp,
  multiplyToCents,
  toScaledDecimal,
} from "../core/utils/decimal";

const positiveQuantity = z
  .number()
  .finite()
  .positive()
  .max(100000000);

const MAX_PRICE_DECIMALS = 6;

const nonNegativePrice = z
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine(
    (value) => toScaledDecimal(value).scale <= MAX_PRICE_DECIMALS,
    `Unit price can have at most ${MAX_PRICE_DECIMALS} decimal places.`,
  );

const percentage = z
  .number()
  .int()
  .min(0)
  .max(100);

/* AF7 order sheet columns, on every line. */
const orderSheetFields = {
  tapeColor: z.string().trim().max(120).optional().or(z.literal("")),
  finish: z.string().trim().max(120).optional().or(z.literal("")),
  size: z.string().trim().max(60).optional().or(z.literal("")),
  teethType: z.string().trim().max(60).optional().or(z.literal("")),
  slider: z.string().trim().max(120).optional().or(z.literal("")),
};

const catalogLineSchema = z.object({
  kind: z.literal("catalog"),
  ...orderSheetFields,
  productId: z.string().uuid(),
  quantity: positiveQuantity,
  unitPrice: nonNegativePrice,
  discountPercent: percentage.default(0),
  taxPercent: percentage.default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("")),
});

const customLineSchema = z.object({
  kind: z.literal("custom"),
  ...orderSheetFields,
  productName: z.string().trim().min(1).max(180),
  customerReference: z
    .string()
    .trim()
    .max(180)
    .optional()
    .or(z.literal("")),
  skuReference: z
    .string()
    .trim()
    .max(80)
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal("")),
  variant: z
    .string()
    .trim()
    .max(180)
    .optional()
    .or(z.literal("")),
  unit: z.string().trim().min(1).max(40),
  quantity: positiveQuantity,
  unitPrice: nonNegativePrice,
  discountPercent: percentage.default(0),
  taxPercent: percentage.default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .or(z.literal("")),
});

export const salesOrderInputSchema = z
  .object({
    customerId: z.string().uuid(),

    orderDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/),

    deliveryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),

    customerPo: z
      .string()
      .trim()
      .max(80)
      .optional()
      .or(z.literal("")),

    // The factory's own order number (e.g. AF-26-1154); generated when empty.
    orderNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9/-]{1,39}$/, "Use letters, digits, dashes or slashes.")
      .optional()
      .or(z.literal("")),

    notes: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .or(z.literal("")),

    lines: z
      .array(
        z.discriminatedUnion("kind", [
          catalogLineSchema,
          customLineSchema,
        ]),
      )
      .min(1)
      .max(200),
  })
  .refine(
    (input) =>
      !input.deliveryDate ||
      input.deliveryDate >= input.orderDate,
    {
      message:
        "Delivery date cannot be earlier than the order date.",
      path: ["deliveryDate"],
    },
  )
  .superRefine((input, context) => {
    let orderCents = 0n;

    input.lines.forEach((line, index) => {
      const amounts = calculateLineAmountsExact(line);
      orderCents += amounts.grossCents + amounts.taxCents;

      if (amounts.grossCents > MAX_SAFE_CENTS) {
        context.addIssue({
          code: "custom",
          message: "Quantity × unit price is too large for one order line.",
          path: ["lines", index, "unitPrice"],
        });
      }
    });

    if (orderCents > MAX_SAFE_CENTS) {
      context.addIssue({
        code: "custom",
        message: "The order total is too large.",
        path: ["lines"],
      });
    }
  });

/* The order sheet (requirements 1.2, section 6): what the order form sends. */
const sheetText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
export const orderSheetSchema = z
  .object({
    customerId: z.string().uuid(),
    customerPo: sheetText(80),
    orderNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9/-]{1,39}$/, "Use letters, digits, dashes or slashes.").optional().or(z.literal("")),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    notes: sheetText(4000),
    lines: z.array(z.object({
      product: z.string().trim().min(1, "Product is required.").max(120),
      variant: sheetText(120),
      finish: sheetText(120),
      teethType: sheetText(60),
      tapeColor: sheetText(120),
      slider: sheetText(120),
      size: sheetText(60),
      unit: z.string().trim().min(1).max(40),
      quantity: positiveQuantity,
      unitPrice: nonNegativePrice.default(0),
      taxPercent: percentage.default(18),
    })).min(1, "Add at least one line.").max(200),
  })
  .refine((input) => !input.deliveryDate || input.deliveryDate >= input.orderDate, { message: "Delivery date cannot be earlier than the order date.", path: ["deliveryDate"] });

export type OrderSheetInput = z.infer<typeof orderSheetSchema>;

export const salesOrderQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(180)
    .default(""),

  customerId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),

  status: z
    .enum([
      "DRAFT",
      "APPROVED",
      "CANCELLED",
      "",
    ])
    .default(""),

  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),

  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),

  page: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(1),

  pageSize: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25),
});

export const customerInputSchema = z.object({
  // Generated from the name when left empty.
  code: z.string().trim().max(80).optional().or(z.literal("")),
  name: z.string().trim().min(1).max(180),

  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal("")),

  // Consignee details for the AF7 sales tax invoice.
  address: z.string().trim().max(300).optional().or(z.literal("")),
  contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
  ntn: z.string().trim().max(40).optional().or(z.literal("")),
  strn: z.string().trim().max(40).optional().or(z.literal("")),
});

export const customerUpdateSchema = customerInputSchema.omit({ code: true });

export type SalesOrderInput =
  z.infer<typeof salesOrderInputSchema>;

export type SalesOrderQuery =
  z.infer<typeof salesOrderQuerySchema>;

export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type CustomerInput =
  z.infer<typeof customerInputSchema>;

/*
 * Line amounts in whole cents, computed exactly (see core/utils/decimal):
 * gross = quantity × unit price, rounded half up to the cent; the discount
 * applies to gross; tax applies to gross minus discount. Each step rounds
 * half up to the cent.
 */
export function calculateLineAmountsExact(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}) {
  const grossCents = multiplyToCents(input.quantity, input.unitPrice);
  const discountCents = divideRoundHalfUp(
    grossCents * BigInt(input.discountPercent),
    100n,
  );
  const taxCents = divideRoundHalfUp(
    (grossCents - discountCents) * BigInt(input.taxPercent),
    100n,
  );

  return {
    grossCents,
    discountCents,
    taxCents,
    totalCents: grossCents - discountCents + taxCents,
  };
}

export function calculateLineAmounts(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}) {
  const exact = calculateLineAmountsExact(input);

  if (exact.grossCents > MAX_SAFE_CENTS || exact.totalCents > MAX_SAFE_CENTS) {
    throw new RangeError("Line amount exceeds the supported range.");
  }

  return {
    grossCents: Number(exact.grossCents),
    discountCents: Number(exact.discountCents),
    taxCents: Number(exact.taxCents),
    totalCents: Number(exact.totalCents),
  };
}
