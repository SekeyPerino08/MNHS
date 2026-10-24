import { z } from "zod";
import { idSchema } from "../../utils/idSchema.js";

export const myClassesQuerySchema = z.object({
  schoolYearId: idSchema.optional(),
});
