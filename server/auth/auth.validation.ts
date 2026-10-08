import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("A valid email address is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const createUserSchema = z.object({
  employeeCode: z.string().trim().min(2, "Employee code is required."),
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("A valid email address is required."),
  phone: z.string().trim().optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters."),
  roles: z.array(z.string()).default([]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
