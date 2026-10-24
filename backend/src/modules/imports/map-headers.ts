import { AppError } from "../../utils/AppError.js";
import type { ImportField } from "./import.types.js";

const aliases: Record<string, ImportField> = {
  "student no": "studentNo",
  "student number": "studentNo",
  studentno: "studentNo",
  lrn: "studentNo",
  "student id": "studentNo",
  "first name": "firstName",
  firstname: "firstName",
  "given name": "firstName",
  "middle name": "middleName",
  middlename: "middleName",
  "last name": "lastName",
  lastname: "lastName",
  surname: "lastName",
  sex: "sex",
  gender: "sex",
  "birth date": "birthDate",
  birthdate: "birthDate",
  "date of birth": "birthDate",
  dateofbirth: "birthDate",
  dob: "birthDate",
  address: "address",
  "guardian name": "guardianName",
  guardianname: "guardianName",
  "parent/guardian": "guardianName",
  "guardian contact": "guardianContact",
  guardiancontact: "guardianContact",
  "guardian contact number": "guardianContact",
  guardiancontactnumber: "guardianContact",
  "contact number": "guardianContact",
  "guardian phone": "guardianContact",
  "contact no": "contactNo",
  contactno: "contactNo",
  "guardian contact no": "guardianContact",
  "phone number": "contactNo",
  "employee no": "employeeNo",
  "employee number": "employeeNo",
  employeeno: "employeeNo",
  "staff no": "employeeNo",
  "grade level": "gradeLevel",
  gradelevel: "gradeLevel",
  grade: "gradeLevel",
  section: "section",
  "section name": "section",
  sectionname: "section",
  department: "department",
};

const requiredFields: Record<"STUDENTS" | "TEACHERS", ImportField[]> = {
  STUDENTS: ["studentNo", "firstName", "lastName", "sex", "birthDate"],
  TEACHERS: ["employeeNo", "firstName", "lastName"],
};

export interface HeaderMap {
  indexes: Partial<Record<ImportField, number>>;
  fields: Partial<Record<ImportField, string>>;
  hasEnrollmentColumns: boolean;
}

export function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function mapHeaders(headers: string[], type: "STUDENTS" | "TEACHERS"): HeaderMap {
  const indexes: Partial<Record<ImportField, number>> = {};
  const fields: Partial<Record<ImportField, string>> = {};
  const seenHeaders = new Set<string>();
  const duplicateHeaders: string[] = [];

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (seenHeaders.has(normalized)) duplicateHeaders.push(header);
    seenHeaders.add(normalized);
  }
  if (duplicateHeaders.length) {
    throw new AppError(
      `Duplicate columns found: ${[...new Set(duplicateHeaders)].join(", ")}`,
      400,
      "DUPLICATE_HEADERS",
    );
  }

  const duplicates: string[] = [];
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    let field = aliases[normalized];
    if (type === "TEACHERS" && field === "guardianContact") field = "contactNo";
    if (type === "STUDENTS" && field === "contactNo") field = "guardianContact";
    if (!field) return;
    if (indexes[field] !== undefined) {
      duplicates.push(field);
      return;
    }
    indexes[field] = index;
    fields[field] = header;
  });

  if (duplicates.length) {
    throw new AppError(
      `Duplicate columns map to the same field: ${[...new Set(duplicates)].join(", ")}`,
      400,
      "DUPLICATE_HEADERS",
    );
  }

  const missing = requiredFields[type].filter((field) => indexes[field] === undefined);
  if (missing.length) {
    throw new AppError(
      `Missing required columns: ${missing.join(", ")}`,
      400,
      "MISSING_HEADERS",
      { missing },
    );
  }

  return {
    indexes,
    fields,
    hasEnrollmentColumns: indexes.gradeLevel !== undefined && indexes.section !== undefined,
  };
}

export function valueAt(
  cells: string[],
  indexes: Partial<Record<ImportField, number>>,
  field: ImportField,
): string {
  const index = indexes[field];
  return index === undefined ? "" : (cells[index] ?? "").trim();
}
