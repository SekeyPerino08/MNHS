import { ImportType } from "@prisma/client";
import { AppError } from "../../../utils/AppError.js";
import type { HeaderMapping, ImportField } from "../import.types.js";

const aliases: Record<ImportType, Record<string, ImportField>> = {
  STUDENTS: {
    lrn: "studentNo",
    studentno: "studentNo",
    "student no": "studentNo",
    "student number": "studentNo",
    "student id": "studentNo",
    "id number": "studentNo",
    "first name": "firstName",
    firstname: "firstName",
    "given name": "firstName",
    "middle name": "middleName",
    middlename: "middleName",
    "middle initial": "middleName",
    "last name": "lastName",
    lastname: "lastName",
    surname: "lastName",
    "family name": "lastName",
    sex: "sex",
    gender: "sex",
    birthdate: "birthDate",
    "birth date": "birthDate",
    "date of birth": "birthDate",
    dob: "birthDate",
    birthday: "birthDate",
    address: "address",
    guardian: "guardianName",
    "guardian name": "guardianName",
    guardianname: "guardianName",
    parent: "guardianName",
    "parent name": "guardianName",
    contact: "guardianContact",
    "contact no": "guardianContact",
    "contact number": "guardianContact",
    "guardian contact": "guardianContact",
    guardiancontact: "guardianContact",
    phone: "guardianContact",
    mobile: "guardianContact",
    grade: "gradeLevel",
    "grade level": "gradeLevel",
    gradelevel: "gradeLevel",
    "year level": "gradeLevel",
    section: "section",
    "section name": "section",
    sectionname: "section",
  },
  TEACHERS: {
    employeeno: "employeeNo",
    "employee no": "employeeNo",
    "employee number": "employeeNo",
    "employee id": "employeeNo",
    "teacher id": "employeeNo",
    "first name": "firstName",
    firstname: "firstName",
    "given name": "firstName",
    "middle name": "middleName",
    middlename: "middleName",
    "middle initial": "middleName",
    "last name": "lastName",
    lastname: "lastName",
    surname: "lastName",
    "family name": "lastName",
    department: "department",
    contact: "contactNo",
    contactno: "contactNo",
    "contact no": "contactNo",
    "contact number": "contactNo",
    phone: "contactNo",
    mobile: "contactNo",
  },
};

const required: Record<ImportType, ImportField[]> = {
  STUDENTS: ["studentNo", "firstName", "lastName", "sex", "birthDate"],
  TEACHERS: ["employeeNo", "firstName", "lastName"],
};

export function normalizeHeader(value: string): string {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

export function mapHeaders(headers: string[], type: ImportType): HeaderMapping {
  const fields: Partial<Record<ImportField, number>> = {};
  const recognized: HeaderMapping["recognized"] = [];
  const ignored: string[] = [];
  const duplicates = new Set<ImportField>();

  headers.forEach((column, index) => {
    const field = aliases[type][normalizeHeader(column)];
    if (!field) {
      ignored.push(column);
      return;
    }
    if (fields[field] !== undefined) {
      duplicates.add(field);
      return;
    }
    fields[field] = index;
    recognized.push({ column, field });
  });

  if (duplicates.size) {
    throw new AppError(
      `Multiple columns map to the same field: ${[...duplicates].join(", ")}`,
      400,
      "DUPLICATE_COLUMNS",
      { duplicates: [...duplicates] },
    );
  }
  const missing = required[type].filter((field) => fields[field] === undefined);
  if (missing.length) {
    throw new AppError(
      `Missing required columns: ${missing.join(", ")}`,
      400,
      "MISSING_COLUMNS",
      { missing },
    );
  }
  return {
    recognized,
    ignored,
    fields,
    hasGradeLevel: fields.gradeLevel !== undefined,
    hasSection: fields.section !== undefined,
  };
}
