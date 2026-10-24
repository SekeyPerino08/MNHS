import { z } from "zod";

const id = z.string().trim().min(1, "An ID is required");
const page = z.coerce.number().int().positive().default(1);
const pageSize = z.coerce.number().int().positive().max(100).default(10);

const offeringItemSchema = z.object({
  subjectId: id,
  teacherId: id,
});

export const createClassOfferingSchema = z.object({
  sectionId: id,
  ...offeringItemSchema.shape,
});

export const bulkCreateClassOfferingsSchema = z.object({
  sectionId: id,
  items: z.array(offeringItemSchema).min(1, "Add at least one class offering").max(100, "Create at most 100 offerings at a time"),
});

export const updateClassOfferingSchema = z.object({ teacherId: id });

export const listClassOfferingsQuerySchema = z.object({
  page,
  pageSize,
  schoolYearId: id.optional(),
  sectionId: id.optional(),
  teacherId: id.optional(),
  subjectId: id.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
});

export const listTeacherClassesQuerySchema = z.object({
  schoolYearId: id.optional(),
});

export type CreateClassOfferingInput = z.infer<typeof createClassOfferingSchema>;
export type BulkCreateClassOfferingsInput = z.infer<typeof bulkCreateClassOfferingsSchema>;
export type UpdateClassOfferingInput = z.infer<typeof updateClassOfferingSchema>;
