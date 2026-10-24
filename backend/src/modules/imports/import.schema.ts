import { z } from "zod";

export const importTypeSchema = z.enum(["STUDENTS", "TEACHERS"]);

export const previewOptionsSchema = z.object({
  dateFormat: z.enum(["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"]).default("YYYY-MM-DD"),
});

export const importRowsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const importHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  type: importTypeSchema.optional(),
  status: z.enum(["PREVIEWED", "COMMITTED", "DISCARDED", "EXPIRED"]).optional(),
});

export const commitImportSchema = z.object({
  rowNumbers: z.array(z.number().int().positive()).max(1000).optional(),
});

export type PreviewOptionsInput = z.infer<typeof previewOptionsSchema>;
