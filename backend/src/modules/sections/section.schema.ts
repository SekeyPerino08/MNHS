import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

const spaces = (value: string) => value.trim().replace(/\s+/g, " ");
const sectionName = z.string().transform(spaces).pipe(z.string().min(1).max(80));

export const listSectionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  search: z.string().optional().transform((value) => (value ? spaces(value) : undefined)),
});

export const createSectionSchema = z.object({
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12),
  name: sectionName,
  adviserId: idSchema.nullable().optional(),
});

export const updateSectionSchema = z.object({
  name: sectionName.optional(),
  adviserId: idSchema.nullable().optional(),
  schoolYearId: idSchema.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
