import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

export const reportCardQuerySchema = z.object({
  schoolYearId: idSchema.optional(),
  includeUnreleased: z.preprocess((value) => {
    if (typeof value === "string") return value === "true" || value === "1";
    if (typeof value === "boolean") return value;
    return false;
  }, z.boolean().default(false)).optional(),
});

export const sectionReportCardsQuerySchema = z.object({
  includeUnreleased: z.preprocess((value) => {
    if (typeof value === "string") return value === "true" || value === "1";
    if (typeof value === "boolean") return value;
    return false;
  }, z.boolean().default(false)).optional(),
});
