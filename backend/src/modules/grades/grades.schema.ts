import { z } from "zod";

const scoreSchema = z.number().min(0).max(100).refine(
  (score) => Math.abs(score * 100 - Math.round(score * 100)) < 1e-8,
  "Score must have at most two decimal places",
).nullable();

export const saveGradesSchema = z.object({
  termId: z.string().min(1),
  records: z.array(z.object({
    studentId: z.string().min(1),
    score: scoreSchema,
    remarks: z.string().max(200).optional(),
  })).min(1).max(200).refine(
    (records) => new Set(records.map(({ studentId }) => studentId)).size === records.length,
    "studentIds must be unique",
  ),
});

export const gradeSummaryQuerySchema = z.object({
  termId: z.string().min(1).optional(),
});

export const termLockSchema = z.object({
  locked: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export const schoolYearQuerySchema = z.object({
  schoolYearId: z.string().min(1).optional(),
});

export const gradeOverviewQuerySchema = z.object({
  termId: z.string().min(1),
});

export type SaveGradesInput = z.infer<typeof saveGradesSchema>;
export type TermLockInput = z.infer<typeof termLockSchema>;
