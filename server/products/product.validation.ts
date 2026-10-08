import { z } from "zod";

const productFields = {
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(120),
  productType: z.string().trim().min(1).max(80),
  variant: z.string().trim().max(180).optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(40),
  unitPrice: z.number().finite().min(0).max(100000000),
  status: z.enum(["ACTIVE", "INACTIVE"]),
};

export const productInputSchema = z.object(productFields);

export const productQuerySchema = z.object({
  search: z.string().trim().max(180).default(""),
  category: z.string().trim().max(120).default(""),
  productType: z.string().trim().max(80).default(""),
  variant: z.string().trim().max(180).default(""),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", ""]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
