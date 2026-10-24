import { createStudentSchema } from "../students/student.schema.js";
import { createTeacherSchema } from "../teachers/teacher.schema.js";
import { normalizeSpaces } from "../../utils/name-normalization.js";
import type { ImportType } from "@prisma/client";
import type {
  ImportOptions,
  ImportPreviewRow,
  ParsedCsv,
  RowIssue,
  StudentImportValues,
  TeacherImportValues,
} from "./import.types.js";
import { valueAt, type HeaderMap } from "./map-headers.js";

function parseDate(value: string, format: ImportOptions["dateFormat"]): string | null {
  if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(value) || /^\d{4,}\.0+$/.test(value)) return null;
  let yearText: string;
  let monthText: string;
  let dayText: string;
  if (format === "YYYY-MM-DD") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    [, yearText, monthText, dayText] = match;
  } else if (format === "MM/DD/YYYY") {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    [, monthText, dayText, yearText] = match;
  } else {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    [, dayText, monthText, yearText] = match;
  }
  monthText = monthText.padStart(2, "0");
  dayText = dayText.padStart(2, "0");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
}

function errorIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): RowIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "row",
    message: issue.message,
  }));
}

function previewValues(values: object): Record<string, string | number | null> {
  const preview: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number" || value === null) {
      preview[key] = value;
    }
  }
  return preview;
}

export function transformRows(
  parsed: ParsedCsv,
  headerMap: HeaderMap,
  type: ImportType,
  options: ImportOptions,
): ImportPreviewRow[] {
  return parsed.rows.map(({ cells, rowNumber }) => {
    const errors: RowIssue[] = [];
    const warnings: RowIssue[] = [];
    if (cells.length !== parsed.headers.length) {
      errors.push({ field: "row", message: "The number of cells does not match the header columns" });
    }

    if (type === "STUDENTS") {
      const studentNo = normalizeSpaces(valueAt(cells, headerMap.indexes, "studentNo"));
      if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(studentNo) || /^\d{3,}\.0+$/.test(studentNo)) {
        errors.push({ field: "studentNo", message: "Student number looks like an Excel-converted number; import it as text" });
      }
      const rawBirthDate = valueAt(cells, headerMap.indexes, "birthDate");
      const birthDate = parseDate(rawBirthDate, options.dateFormat);
      if (!birthDate) {
        errors.push({
          field: "birthDate",
          message: `Enter a real date in ${options.dateFormat} format`,
        });
      }
      const sex = normalizeSpaces(valueAt(cells, headerMap.indexes, "sex")).toLocaleUpperCase();
      const parsedStudent = createStudentSchema.safeParse({
        studentNo,
        firstName: valueAt(cells, headerMap.indexes, "firstName"),
        middleName: valueAt(cells, headerMap.indexes, "middleName") || undefined,
        lastName: valueAt(cells, headerMap.indexes, "lastName"),
        sex: sex === "M" ? "MALE" : sex === "F" ? "FEMALE" : sex,
        birthDate: birthDate ?? "",
        address: valueAt(cells, headerMap.indexes, "address"),
        guardianName: valueAt(cells, headerMap.indexes, "guardianName"),
        guardianContact: valueAt(cells, headerMap.indexes, "guardianContact"),
      });
      if (!parsedStudent.success) errors.push(...errorIssues(parsedStudent.error));
      const rawGrade = valueAt(cells, headerMap.indexes, "gradeLevel");
      const rawSection = valueAt(cells, headerMap.indexes, "section");
      const gradeLevel = rawGrade ? Number(rawGrade) : undefined;
      if (rawGrade && (!Number.isInteger(gradeLevel) || gradeLevel! < 7 || gradeLevel! > 12)) {
        errors.push({ field: "gradeLevel", message: "Grade level must be a whole number from 7 to 12" });
      }
      if ((rawGrade || rawSection) && !headerMap.hasEnrollmentColumns) {
        errors.push({ field: "section", message: "Both Grade Level and Section columns are required for enrollment" });
      }
      if (parsedStudent.success) {
        const values: StudentImportValues = {
          studentNo: parsedStudent.data.studentNo,
          firstName: parsedStudent.data.firstName,
          middleName: parsedStudent.data.middleName ?? null,
          lastName: parsedStudent.data.lastName,
          sex: parsedStudent.data.sex,
          birthDate: parsedStudent.data.birthDate.toISOString().slice(0, 10),
          address: parsedStudent.data.address ?? null,
          guardianName: parsedStudent.data.guardianName ?? null,
          guardianContact: parsedStudent.data.guardianContact ?? null,
          ...(rawGrade ? { gradeLevel } : {}),
          ...(rawSection ? { section: normalizeSpaces(rawSection) } : {}),
        };
        return {
          rowNumber,
          raw: cells,
          values: previewValues(values),
          errors,
          warnings,
          commitData: { ...values },
        };
      }
      return {
        rowNumber,
        raw: cells,
        values: previewValues({
          studentNo,
          firstName: valueAt(cells, headerMap.indexes, "firstName"),
          middleName: valueAt(cells, headerMap.indexes, "middleName"),
          lastName: valueAt(cells, headerMap.indexes, "lastName"),
          sex,
          birthDate: rawBirthDate,
          address: valueAt(cells, headerMap.indexes, "address"),
          guardianName: valueAt(cells, headerMap.indexes, "guardianName"),
          guardianContact: valueAt(cells, headerMap.indexes, "guardianContact"),
          gradeLevel: rawGrade ? Number(rawGrade) : null,
          section: rawSection || null,
        }),
        errors,
        warnings,
      };
    }

    const employeeNo = normalizeSpaces(valueAt(cells, headerMap.indexes, "employeeNo"));
    if (/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(employeeNo) || /^\d{3,}\.0+$/.test(employeeNo)) {
      errors.push({ field: "employeeNo", message: "Employee number looks like an Excel-converted number; import it as text" });
    }
    const parsedTeacher = createTeacherSchema.safeParse({
      employeeNo,
      firstName: valueAt(cells, headerMap.indexes, "firstName"),
      middleName: valueAt(cells, headerMap.indexes, "middleName") || undefined,
      lastName: valueAt(cells, headerMap.indexes, "lastName"),
      department: valueAt(cells, headerMap.indexes, "department"),
      contactNo: valueAt(cells, headerMap.indexes, "contactNo"),
    });
    if (!parsedTeacher.success) errors.push(...errorIssues(parsedTeacher.error));
    if (parsedTeacher.success) {
      const values: TeacherImportValues = {
        employeeNo: parsedTeacher.data.employeeNo,
        firstName: parsedTeacher.data.firstName,
        middleName: parsedTeacher.data.middleName ?? null,
        lastName: parsedTeacher.data.lastName,
        department: parsedTeacher.data.department ?? null,
        contactNo: parsedTeacher.data.contactNo ?? null,
      };
      return { rowNumber, raw: cells, values: previewValues(values), errors, warnings, commitData: values };
    }
    return {
      rowNumber,
      raw: cells,
      values: previewValues({
        employeeNo,
        firstName: valueAt(cells, headerMap.indexes, "firstName"),
        middleName: valueAt(cells, headerMap.indexes, "middleName"),
        lastName: valueAt(cells, headerMap.indexes, "lastName"),
        department: valueAt(cells, headerMap.indexes, "department"),
        contactNo: valueAt(cells, headerMap.indexes, "contactNo"),
      }),
      errors,
      warnings,
    };
  });
}
