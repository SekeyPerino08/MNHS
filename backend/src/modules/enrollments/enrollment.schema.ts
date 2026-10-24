import { EnrollmentStatus } from "@prisma/client";
import { z } from "zod";

const id = z.string().trim().min(1, "An ID is required");
const page = z.coerce.number().int().positive().default(1);
const pageSize = z.coerce.number().int().positive().max(100).default(10);

export const createEnrollmentSchema = z.object({
  studentId: id,
  sectionId: id,
});

export const bulkEnrollSchema = z.object({
  sectionId: id,
  studentIds: z.array(id).min(1, "Select at least one student").max(100, "Enroll at most 100 students at a time"),
});

export const transferEnrollmentSchema = z.object({ sectionId: id });

export const updateEnrollmentStatusSchema = z.object({
  status: z.nativeEnum(EnrollmentStatus),
  reason: z.string().trim().max(500, "Reason must be 500 characters or fewer").optional(),
});

export const listEnrollmentsQuerySchema = z.object({
  page,
  pageSize,
  schoolYearId: id.optional(),
  sectionId: id.optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  status: z.nativeEnum(EnrollmentStatus).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["enrolledAt", "studentNo", "lastName", "status"]).default("enrolledAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const unassignedStudentsQuerySchema = z.object({
  page,
  pageSize,
  schoolYearId: id.optional(),
  search: z.string().trim().max(100).optional(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>;
export type UpdateEnrollmentStatusInput = z.infer<typeof updateEnrollmentStatusSchema>;
