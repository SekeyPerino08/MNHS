import { ImportType } from "@prisma/client";
import { createStudentSchema } from "../../students/student.schema.js";
import { createTeacherSchema } from "../../teachers/teacher.schema.js";
import { titleCaseName } from "../../../utils/name-normalization.js";
import type {
  HeaderMapping,
  ImportChange,
  ImportOptions,
  ImportPreviewRow,
  ParsedCsv,
  ParsedRow,
  RowIssue,
  TransformedRow,
} from "../import.types.js";

const DATE_FORMATS: ImportOptions["dateFormat"][] = ["ISO", "MDY", "DMY"];
const ZERO_WIDTH_AND_SPACES = /[\u200B-\u200D\uFEFF\u00A0]/g;
const SCIENTIFIC_NUMBER = /^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i;
const EXCEL_SERIAL = /^\d{4,}(?:\.0+)?$/;
const FIELD_ORDER: Record<ImportType, string[]> = {
  STUDENTS: [
    "studentNo", "firstName", "middleName", "lastName", "sex", "birthDate",
    "address", "guardianName", "guardianContact", "gradeLevel", "section",
  ],
  TEACHERS: [
    "employeeNo", "firstName", "middleName", "lastName", "department", "contactNo",
  ],
};

export function cleanCell(value: string): string {
  return value
    .replace(ZERO_WIDTH_AND_SPACES, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getCell(row: ParsedRow, fieldIndex: number | undefined): string {
  return fieldIndex === undefined ? "" : cleanCell(row.original[fieldIndex] ?? "");
}

function sourceCell(row: ParsedRow, fieldIndex: number | undefined): string {
  return fieldIndex === undefined ? "" : row.original[fieldIndex] ?? "";
}

function parseDate(value: string, format: ImportOptions["dateFormat"]): string | null {
  if (EXCEL_SERIAL.test(value)) return null;
  let yearText: string;
  let monthText: string;
  let dayText: string;

  if (format === "ISO") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    [, yearText, monthText, dayText] = match;
  } else {
    const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
    if (!match) return null;
    if (format === "MDY") [, monthText, dayText, yearText] = match;
    else [, dayText, monthText, yearText] = match;
    monthText = monthText.padStart(2, "0");
    dayText = dayText.padStart(2, "0");
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    yearText.length !== 4 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

function normalizePhone(value: string): string {
  const compact = value.replace(/[\s\-()]/g, "");
  if (/^\+639\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^639\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

function mapSex(value: string): string | null {
  const sex = value.toLocaleLowerCase();
  if (["m", "male", "lalaki"].includes(sex)) return "MALE";
  if (["f", "female", "babae"].includes(sex)) return "FEMALE";
  return null;
}

function pushChange(changes: ImportChange[], field: string, from: string, to: string | null): void {
  const fromValue = from || null;
  if (fromValue !== to) changes.push({ field, from: fromValue, to });
}

function zodIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): RowIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "row",
    message: issue.message,
  }));
}

function normalizeFields(
  type: ImportType,
  row: ParsedRow,
  mapping: HeaderMapping,
  dateFormat: ImportOptions["dateFormat"],
): { values: Record<string, string | number | null>; changes: ImportChange[]; errors: RowIssue[] } {
  const values: Record<string, string | number | null> = {};
  const changes: ImportChange[] = [];
  const errors = [...row.errors];
  const get = (field: keyof HeaderMapping["fields"]) => getCell(row, mapping.fields[field]);
  const source = (field: keyof HeaderMapping["fields"]) => sourceCell(row, mapping.fields[field]);
  const idField = type === ImportType.STUDENTS ? "studentNo" : "employeeNo";
  const rawId = get(idField);
  const id = rawId.toLocaleUpperCase().replace(/\s+/g, "");
  if (SCIENTIFIC_NUMBER.test(id)) {
    errors.push({
      field: idField,
      message: "This looks like a number Excel converted. Format the column as Text and export again.",
    });
  }
  values[idField] = id;
  pushChange(changes, idField, source(idField), id || null);

  for (const field of ["firstName", "middleName", "lastName"] as const) {
    const raw = get(field);
    const value = raw ? titleCaseName(raw) : null;
    values[field] = value;
    pushChange(changes, field, source(field), value);
  }

  if (type === ImportType.STUDENTS) {
    const rawSex = get("sex");
    const sex = rawSex ? mapSex(rawSex) : null;
    values.sex = sex;
    pushChange(changes, "sex", source("sex"), sex);

    const rawBirthDate = get("birthDate");
    const birthDate = rawBirthDate ? parseDate(rawBirthDate, dateFormat) : null;
    values.birthDate = birthDate;
    pushChange(changes, "birthDate", source("birthDate"), birthDate);
    if (rawBirthDate && !birthDate) {
      const message = EXCEL_SERIAL.test(rawBirthDate)
        ? "Excel serial dates are not supported. Format the cells as dates and export again."
        : `Enter a real date in the selected ${dateFormat} format (four-digit year required).`;
      errors.push({ field: "birthDate", message });
    }
    for (const field of ["address", "guardianName"] as const) {
      const raw = get(field);
      const value = raw || null;
      values[field] = field === "guardianName" && value ? titleCaseName(value) : value;
      pushChange(changes, field, source(field), values[field] as string | null);
    }
    const rawPhone = get("guardianContact");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    values.guardianContact = phone;
    pushChange(changes, "guardianContact", source("guardianContact"), phone);

    if (mapping.hasGradeLevel) {
      const rawGrade = get("gradeLevel");
      const gradeText = rawGrade ? /^grade\s+(\d+)$/i.exec(rawGrade)?.[1] ?? rawGrade : "";
      const grade = gradeText ? Number(gradeText) : null;
      values.gradeLevel = Number.isInteger(grade) ? grade : null;
      pushChange(changes, "gradeLevel", source("gradeLevel"), values.gradeLevel === null ? null : String(grade));
      if (rawGrade && (!Number.isInteger(grade) || Number(grade) < 7 || Number(grade) > 12)) {
        errors.push({ field: "gradeLevel", message: "Grade level must be from 7 to 12" });
      }
    }
    if (mapping.hasSection) {
      const rawSection = get("section");
      values.section = rawSection || null;
      pushChange(changes, "section", source("section"), rawSection || null);
    }
    if (mapping.hasGradeLevel !== mapping.hasSection) {
      errors.push({
        field: mapping.hasGradeLevel ? "section" : "gradeLevel",
        message: "Grade Level and Section columns must both be provided for enrollment",
      });
    }
  } else {
    for (const field of ["department", "contactNo"] as const) {
      const raw = get(field);
      const value = field === "contactNo" && raw ? normalizePhone(raw) : raw || null;
      values[field] = value;
      pushChange(changes, field, source(field), value);
    }
  }

  return { values, changes, errors };
}

export function transformRows(
  parsed: ParsedCsv,
  mapping: HeaderMapping,
  type: ImportType,
  options: ImportOptions,
): TransformedRow[] {
  if (!DATE_FORMATS.includes(options.dateFormat)) {
    throw new Error("Unsupported date format");
  }
  return parsed.rows.map((row) => {
    const transformed = normalizeFields(type, row, mapping, options.dateFormat);
    const values = transformed.values;
    if (type === ImportType.STUDENTS) {
      const student = createStudentSchema.safeParse({
        studentNo: values.studentNo,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        sex: values.sex,
        birthDate: values.birthDate ?? "",
        address: values.address ?? "",
        guardianName: values.guardianName ?? "",
        guardianContact: values.guardianContact ?? "",
      });
      if (!student.success) transformed.errors.push(...zodIssues(student.error));
    } else {
      const teacher = createTeacherSchema.safeParse({
        employeeNo: values.employeeNo,
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        department: values.department ?? "",
        contactNo: values.contactNo ?? "",
      });
      if (!teacher.success) transformed.errors.push(...zodIssues(teacher.error));
    }
    const errors = dedupeIssues(transformed.errors);
    const normalized = errors.length ? null : values;
    return {
      rowNumber: row.rowNumber,
      status: errors.length ? "ERROR" : "VALID",
      errors,
      warnings: [],
      original: row.original,
      normalized,
      changes: transformed.changes,
      pending: values,
    };
  });
}

function dedupeIssues(issues: RowIssue[]): RowIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
