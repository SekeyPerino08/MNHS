import { z } from "zod";
const validName = z.string().trim().regex(/^\d{4}-\d{4}$/, 'Use the format "YYYY-YYYY"')
  .refine((name) => Number(name.slice(5)) === Number(name.slice(0, 4)) + 1, "The second year must be the first year plus one");
export const schoolYearSchema = z.object({
  name: validName,
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
}).refine((value) => new Date(value.endDate) > new Date(value.startDate), { message: "End date must be after start date", path: ["endDate"] });
export const termSchema = z.object({
  name: z.string().trim().min(1, "Term name is required").max(80),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
}).refine((value) => new Date(value.endDate) >= new Date(value.startDate), { message: "End date must not be before start date", path: ["endDate"] });
