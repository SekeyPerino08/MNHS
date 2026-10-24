import { z } from "zod";

export const importTypeSchema = z.enum(["STUDENTS", "TEACHERS"]);

export const previewOptionsSchema = z.object({
  type: importTypeSchema,
  dateFormat: z.enum(["ISO", "MDY", "DMY"]).default("ISO"),
});

export const importRowsQuerySchema = z.object({
  status: z.enum(["ALL", "VALID", "WARNING", "ERROR"]).default("ALL"),
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
  includeWarnings: z.boolean().default(false),
}).default({});

export type PreviewOptionsInput = z.infer<typeof previewOptionsSchema>;
