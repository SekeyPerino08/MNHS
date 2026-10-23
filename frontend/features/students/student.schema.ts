import { z } from "zod";

const cleanSpaces = (value: string) => value.trim().replace(/\s+/g, " ");
const titleCase = (value: string) =>
  cleanSpaces(value)
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`,
    );
const nameField = z.string().trim().min(1, "Required").max(60).transform(titleCase);
const optionalField = z
  .string()
  .transform(cleanSpaces)
  .transform((value) => value || undefined)
  .optional();

export const studentFormSchema = z.object({
  studentNo: z
    .string()
    .trim()
    .min(3, "Student number must be at least 3 characters")
    .max(20, "Student number must be at most 20 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and dashes"),
  firstName: nameField,
  middleName: z.string().trim().transform(titleCase).optional(),
  lastName: nameField,
  sex: z.enum(["MALE", "FEMALE"]),
  birthDate: z
    .string()
    .min(1, "Birth date is required")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date")
    .refine((value) => new Date(`${value}T00:00:00`).getTime() <= Date.now(), "Birth date cannot be in the future")
    .refine((value) => {
      const birth = new Date(`${value}T00:00:00`);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
      return age >= 5 && age <= 30;
    }, "Student must be between 5 and 30 years old"),
  address: optionalField,
  guardianName: optionalField,
  guardianContact: z
    .string()
    .transform(cleanSpaces)
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || /^[+]?[\d\s().-]{7,30}$/.test(value),
      "Enter a valid phone number",
    )
    .optional(),
});

export type StudentFormValues = z.input<typeof studentFormSchema>;
export type ParsedStudentFormValues = z.output<typeof studentFormSchema>;
