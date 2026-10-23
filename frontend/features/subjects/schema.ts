import { z } from "zod";
const spaced = (value: string) => value.trim().replace(/\s+/g, " ");
export const subjectSchema = z.object({
  code: z.string().transform((value) => spaced(value).toUpperCase())
    .pipe(z.string().min(2, "Code must be 2-15 characters").max(15).regex(/^[A-Z0-9-]+$/, "Use letters, numbers, and dashes only")),
  name: z.string().transform(spaced).pipe(z.string().min(1, "Name is required").max(100)),
  description: z.string().transform(spaced).transform((value) => value || null).pipe(z.string().max(1000).nullable()).optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12),
});
export type SubjectFormValues = z.input<typeof subjectSchema>;
