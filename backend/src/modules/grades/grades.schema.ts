import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

const scoreSchema = z.number().min(0).max(100).refine(
  (score) => Math.abs(score * 100 - Math.round(score * 100)) < 1e-8,
  "Score must have at most two decimal places",
).nullable();

export const saveGradesSchema = z.object({
  termId: idSchema,
  records: z.array(z.object({
    studentId: idSchema,
    score: scoreSchema,
    remarks: z.string().max(200).optional(),
  })).min(1).max(200).refine(
    (records) => new Set(records.map(({ studentId }) => studentId)).size === records.length,
    "studentIds must be unique",
  ),
});

export const gradeSummaryQuerySchema = z.object({
  termId: idSchema.optional(),
});

export const termLockSchema = z.object({
  locked: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const schoolYearQuerySchema = z.object({
  schoolYearId: idSchema.optional(),
});

export const gradeOverviewQuerySchema = z.object({
  termId: idSchema,
});

export type SaveGradesInput = z.infer<typeof saveGradesSchema>;
export type TermLockInput = z.infer<typeof termLockSchema>;
