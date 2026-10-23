import { z } from "zod";

const validYearName = z.string().trim().regex(/^\d{4}-\d{4}$/, 'School year must use the format "YYYY-YYYY"')
  .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, "The second year must be one year after the first");

export const createSchoolYearSchema = z.object({
  name: validYearName,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine((value) => value.endDate > value.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((value) => value.endDate.getTime() - value.startDate.getTime() >= 3 * 24 * 60 * 60 * 1000, {
  message: "The date range must be at least four days to create four terms",
  path: ["endDate"],
});

export const updateSchoolYearSchema = z.object({
  name: validYearName.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
}).refine((value) => value.startDate === undefined || value.endDate === undefined || value.endDate > value.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const updateTermSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine((value) => value.endDate >= value.startDate, {
  message: "Term end date must be on or after its start date",
  path: ["endDate"],
});

export type CreateSchoolYearInput = z.infer<typeof createSchoolYearSchema>;
export type UpdateSchoolYearInput = z.infer<typeof updateSchoolYearSchema>;
export type UpdateTermInput = z.infer<typeof updateTermSchema>;
