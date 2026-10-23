import { StudentStatus, Sex } from "@prisma/client";
import { z } from "zod";

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return normalizeSpaces(value)
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) => {
      return `${separator}${letter.toLocaleUpperCase()}`;
    });
}

const nameSchema = (maximum = 60) =>
  z
    .string()
    .transform(titleCase)
    .pipe(z.string().min(1).max(maximum));

const optionalTextSchema = (maximum: number) =>
  z
    .string()
    .transform(normalizeSpaces)
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().max(maximum).nullable())
    .optional();

const birthDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid birth date")
  .transform((value) => new Date(value))
  .refine((birthDate) => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const birthUtc = Date.UTC(birthDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
    if (birthUtc > todayUtc) return false;

    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    if (
      now.getUTCMonth() < birthDate.getUTCMonth() ||
      (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }
    return age >= 5 && age <= 30;
  }, "Student must be between 5 and 30 years old");

const optionalBirthDateSchema = birthDateSchema.optional();

const phoneSchema = optionalTextSchema(30).refine(
  (value) => value == null || /^[+]?[\d\s().-]{7,30}$/.test(value),
  "Enter a valid guardian contact number",
);

const studentFields = {
  firstName: nameSchema(),
  middleName: nameSchema(60).nullable().optional(),
  lastName: nameSchema(),
  sex: z.nativeEnum(Sex),
  birthDate: birthDateSchema,
  address: optionalTextSchema(300),
  guardianName: optionalTextSchema(120).transform((value) =>
    value == null ? value : titleCase(value),
  ),
  guardianContact: phoneSchema,
};

export const createStudentSchema = z.object({
  studentNo: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Student number may contain only letters, numbers, and dashes"),
  ...studentFields,
  confirmDuplicate: z.boolean().optional(),
});

export const updateStudentSchema = z
  .object({
    firstName: nameSchema().optional(),
    middleName: nameSchema(60).nullable().optional(),
    lastName: nameSchema().optional(),
    sex: z.nativeEnum(Sex).optional(),
    birthDate: optionalBirthDateSchema,
    address: optionalTextSchema(300),
    guardianName: optionalTextSchema(120).transform((value) =>
      value == null ? value : titleCase(value),
    ),
    guardianContact: phoneSchema,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field must be provided",
  });

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional().transform((value) => (value ? normalizeSpaces(value) : undefined)),
  status: z.nativeEnum(StudentStatus).optional(),
  gradeLevel: z.coerce.number().int().min(7).max(12).optional(),
  sectionId: z.string().trim().min(1).optional(),
  schoolYearId: z.string().trim().min(1).optional(),
  sortBy: z.enum(["lastName", "firstName", "studentNo", "createdAt"]).default("lastName"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(StudentStatus),
  reason: optionalTextSchema(500),
});

export const createAccountSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  temporaryPassword: z.string().min(8).max(128).optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
