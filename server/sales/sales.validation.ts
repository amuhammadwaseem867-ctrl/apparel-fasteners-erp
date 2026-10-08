import { z } from "zod";

const positiveQuantity = z
  .number()
  .finite()
  .positive()
  .max(100000000);

const nonNegativePrice = z
  .number()
  .finite()
  .min(0)
  .max(100000000);

const percentage = z
  .number()
  .int()
  .min(0)
  .max(100);

const catalogLineSchema = z.object({
  kind: z.literal("catalog"),
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
  );

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
  code: z.string().trim().min(1).max(80),
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
});

export type SalesOrderInput =
  z.infer<typeof salesOrderInputSchema>;

export type SalesOrderQuery =
  z.infer<typeof salesOrderQuerySchema>;

export type CustomerInput =
  z.infer<typeof customerInputSchema>;

export function calculateLineAmounts(input: {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}) {
  const grossCents = Math.round(
    input.quantity * input.unitPrice * 100,
  );

  const discountCents = Math.round(
    (grossCents * input.discountPercent) / 100,
  );

  const taxCents = Math.round(
    ((grossCents - discountCents) *
      input.taxPercent) /
      100,
  );

  return {
    grossCents,
    discountCents,
    taxCents,
    totalCents:
      grossCents -
      discountCents +
      taxCents,
  };
}
