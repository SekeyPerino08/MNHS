import { z } from "zod";
export const sectionSchema = z.object({
  schoolYearId: z.string().optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12),
  name: z.string().trim().min(1, "Section name is required").max(80).transform((value) => value.replace(/\s+/g, " ")),
  adviserId: z.string().nullable().optional(),
});
