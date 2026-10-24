import { z } from "zod";
import { normalizeSpaces, titleCaseName } from "../../utils/name-normalization.js";

const spaces = normalizeSpaces;
const name = z.string().transform(titleCaseName).pipe(z.string().min(1).max(60));
const optionalText = (max: number) =>
  z.string().transform(spaces).transform((value) => value || null).pipe(z.string().max(max).nullable()).optional();

export const listTeachersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional().transform((value) => (value ? spaces(value) : undefined)),
  isActive: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true"),
  sortBy: z.enum(["lastName", "employeeNo", "createdAt"]).default("lastName"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const createTeacherSchema = z.object({
  employeeNo: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9-]+$/, "Employee number may contain only letters, numbers, and dashes"),
  firstName: name,
  lastName: name,
  middleName: name.nullable().optional(),
  department: optionalText(100),
  contactNo: optionalText(30).refine((value) => value == null || /^[+]?[\d\s().-]{7,30}$/.test(value), "Enter a valid contact number"),
});

export const updateTeacherSchema = z.object({
  firstName: name.optional(),
  lastName: name.optional(),
  middleName: name.nullable().optional(),
  department: optionalText(100),
  contactNo: optionalText(30).refine((value) => value == null || /^[+]?[\d\s().-]{7,30}$/.test(value), "Enter a valid contact number"),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

export const updateTeacherStatusSchema = z.object({
  isActive: z.boolean(),
  reason: optionalText(500),
});

export const createTeacherAccountSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  temporaryPassword: z.string().min(8).max(128).optional(),
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type UpdateTeacherStatusInput = z.infer<typeof updateTeacherStatusSchema>;
export type CreateTeacherAccountInput = z.infer<typeof createTeacherAccountSchema>;
