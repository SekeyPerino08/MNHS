import { StudentStatus } from "@prisma/client";
import { z } from "zod";

const dateFilter = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Use a real calendar date in YYYY-MM-DD format");

const booleanFilter: z.ZodType<boolean, z.ZodTypeDef, unknown> = z.preprocess((value: unknown) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}, z.boolean());

const optionalBoolean = booleanFilter.optional().default(false);

export const studentsMasterlistSchema = z.object({
  schoolYearId: z.string().trim().min(1).optional(),
  gradeLevel: z.coerce.number().int().min(1).max(12).optional(),
  sectionId: z.string().trim().min(1).optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  enrollment: z.enum(["enrolled", "unassigned", "all"]).default("all"),
  includeContact: optionalBoolean,
});

export const sectionIdSchema = z.object({
  sectionId: z.string().trim().min(1),
});

export const classOfferingIdSchema = z.object({
  classOfferingId: z.string().trim().min(1),
});

export const classAttendanceSchema = z.object({
  classOfferingId: z.string().trim().min(1),
  from: dateFilter.optional(),
  to: dateFilter.optional(),
  layout: z.enum(["summary", "daily"]).default("summary"),
});

export const sectionGradesSchema = z.object({
  sectionId: z.string().trim().min(1),
  termId: z.string().trim().min(1),
  includeUnreleased: optionalBoolean,
});

export const teachersListSchema = z.object({
  isActive: booleanFilter.optional(),
});

export const auditLogSchema = z.object({
  from: dateFilter,
  to: dateFilter,
  action: z.string().trim().min(1).optional(),
  entity: z.string().trim().min(1).optional(),
}).refine((filters) => filters.from <= filters.to, {
  message: "from must be on or before to",
  path: ["from"],
});
