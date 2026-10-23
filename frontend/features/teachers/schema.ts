import { z } from "zod";

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
const title = z.string().transform((value) => normalize(value).toLocaleLowerCase()
  .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase()}`))
  .pipe(z.string().min(1, "Required").max(60));
const optional = (max: number) => z.string().transform(normalize).transform((value) => value || null).pipe(z.string().max(max).nullable()).optional();
const contact = optional(30).refine((value) => value == null || /^[+]?[\d\s().-]{7,30}$/.test(value), "Enter a valid contact number");

export const teacherFormSchema = z.object({
  employeeNo: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9-]+$/, "Use 3-20 letters, numbers, or dashes"),
  firstName: title,
  middleName: title.nullable().optional(),
  lastName: title,
  department: optional(100),
  contactNo: contact,
});
export const teacherEditSchema = teacherFormSchema.omit({ employeeNo: true });
export type TeacherFormValues = z.input<typeof teacherFormSchema>;
export type TeacherParsedValues = z.output<typeof teacherFormSchema>;
