import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import { isValidDateString } from "../../utils/dates.js";
import { idSchema } from "../../utils/idSchema.js";

const dateSchema = z.string().refine(isValidDateString, "Expected a real date in YYYY-MM-DD format");

export const attendanceDateQuerySchema = z.object({
  date: dateSchema.optional(),
});

export const saveAttendanceSchema = z.object({
  date: dateSchema,
  records: z.array(z.object({
    studentId: idSchema,
    status: z.nativeEnum(AttendanceStatus),
    remarks: z.string().max(200).optional(),
  })).min(1).refine(
    (records) => new Set(records.map(({ studentId }) => studentId)).size === records.length,
    "studentIds must be unique",
  ),
});

export const attendanceSummaryQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const attendanceMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected month in YYYY-MM format"),
});

export const studentAttendanceQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  classOfferingId: idSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
