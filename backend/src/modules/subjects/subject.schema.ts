import { z } from "zod";

const spaces = (value: string) => value.trim().replace(/\s+/g, " ");
const code = z.string().transform((value) => spaces(value).toUpperCase())
  .pipe(z.string().min(2).max(15).regex(/^[A-Z0-9-]+$/, "Code may contain only letters, numbers, and dashes"));
const text = z.string().transform(spaces).pipe(z.string().min(1).max(100));
const description = z.string().transform(spaces).transform((value) => value || null)
  .pipe(z.string().max(1000).nullable()).optional();

export const listSubjectsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  search: z.string().optional().transform((value) => (value ? spaces(value) : undefined)),
  sortBy: z.enum(["code", "name"]).default("code"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const createSubjectSchema = z.object({
  code,
  name: text,
  description,
  gradeLevel: z.coerce.number().int().min(7, "Grade level must be between 7 and 12").max(12),
});

export const updateSubjectSchema = z.object({
  code: code.optional(),
  name: text.optional(),
  description,
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
