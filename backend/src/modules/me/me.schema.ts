import { z } from "zod";

export const myClassesQuerySchema = z.object({
  schoolYearId: z.string().trim().min(1).optional(),
});
