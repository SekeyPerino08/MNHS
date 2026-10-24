import { ImportType } from "@prisma/client";
import { writeCsv } from "../../../utils/csv.js";
import type { ImportPreviewRow } from "../import.types.js";

const TEMPLATE_COLUMNS: Record<ImportType, string[]> = {
  STUDENTS: [
    "studentNo", "firstName", "middleName", "lastName", "sex", "birthDate",
    "address", "guardianName", "guardianContact", "gradeLevel", "section",
  ],
  TEACHERS: ["employeeNo", "firstName", "middleName", "lastName", "department", "contactNo"],
};

const TEMPLATE_ROWS: Record<ImportType, Array<Record<string, string>>> = {
  STUDENTS: [
    {
      studentNo: "STU-EXAMPLE-01", firstName: "Ana", middleName: "", lastName: "Reyes",
      sex: "FEMALE", birthDate: "2012-05-14", address: "", guardianName: "Maria Reyes",
      guardianContact: "", gradeLevel: "7", section: "Rizal",
    },
    {
      studentNo: "STU-EXAMPLE-02", firstName: "Juan", middleName: "", lastName: "Santos",
      sex: "MALE", birthDate: "2012-09-03", address: "", guardianName: "Jose Santos",
      guardianContact: "", gradeLevel: "7", section: "Rizal",
    },
  ],
  TEACHERS: [
    {
      employeeNo: "EMP-EXAMPLE-01", firstName: "Maria", middleName: "", lastName: "Dela Cruz",
      department: "Mathematics", contactNo: "",
    },
    {
      employeeNo: "EMP-EXAMPLE-02", firstName: "Jose", middleName: "", lastName: "Reyes",
      department: "Science", contactNo: "",
    },
  ],
};

export function csvTemplate(type: ImportType): string {
  const columns = TEMPLATE_COLUMNS[type];
  return writeCsv(TEMPLATE_ROWS[type], columns);
}

export function rejectedRowsCsv(
  rows: ImportPreviewRow[],
  originalHeaders: string[],
): string {
  const columns = ["rowNumber", "status", "messages", ...originalHeaders];
  const csvRows = rows
    .filter((row) => row.status !== "VALID")
    .map((row) => ({
      rowNumber: row.rowNumber,
      status: row.status,
      messages: [...row.errors, ...row.warnings]
        .map(({ field, message }) => `${field}: ${message}`)
        .join("; "),
      ...Object.fromEntries(originalHeaders.map((header, index) => [header, row.original[index] ?? ""])),
    }));
  return writeCsv(csvRows, columns);
}
