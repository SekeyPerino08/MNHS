import { Role } from "@prisma/client";
import { z } from "zod";

const email = z.string().trim().email().transform((value) => value.toLowerCase());

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true"),
  state: z.enum(["locked", "mustChange"]).optional(),
  sortBy: z.enum(["email", "createdAt", "lastLoginAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const createAdminUserSchema = z.object({
  email,
  temporaryPassword: z.string().min(8).max(128).optional(),
});

export const changeEmailSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).max(128).optional(),
});
export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export type CreateAdminUserBody = z.infer<typeof createAdminUserSchema>;
export type ChangeEmailBody = z.infer<typeof changeEmailSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusSchema>;
