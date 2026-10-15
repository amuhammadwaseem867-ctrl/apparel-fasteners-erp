import { z } from "zod";

const uuid = z.string().uuid();
const roleCode = z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Use 2–40 capital letters, digits or underscores.");
const password = z.string().min(8, "Password must be at least 8 characters.").max(200);
const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);

export const userCreateSchema = z.object({
  employeeCode: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password,
  roles: z.array(roleCode).max(20).default([]),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  roles: z.array(roleCode).max(20),
});

export const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) });
export const passwordResetSchema = z.object({ password });

export const roleInputSchema = z.object({
  code: roleCode,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(300),
  permissions: z.array(z.string().trim().max(80)).max(200).default([]),
});

export const roleUpdateSchema = roleInputSchema.omit({ code: true });
export const roleStatusSchema = z.object({ status: z.enum(["ACTIVE", "DISABLED"]) });

export const userQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ACTIVE", "DISABLED", ""]).default(""),
  role: z.string().trim().max(40).default(""),
  page,
  pageSize,
});

export const auditQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  action: z.string().trim().max(80).default(""),
  entityType: z.string().trim().max(80).default(""),
  entityId: z.string().trim().max(120).default(""),
  actorId: uuid.optional().or(z.literal("")),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  page,
  pageSize,
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
