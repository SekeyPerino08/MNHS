import type { ImportType } from "@prisma/client";
import { writeCsv } from "../../utils/csv.js";
import type { ImportPreviewRow, ParsedCsv } from "./import.types.js";

const templates: Record<ImportType, { headers: string[]; sample: string[][] }> = {
  STUDENTS: {
    headers: [
      "Student No", "First Name", "Middle Name", "Last Name", "Sex", "Birth Date",
      "Address", "Guardian Name", "Guardian Contact", "Grade Level", "Section",
    ],
    sample: [
      ["STU-1001", "Juan", "Dela Cruz", "Santos", "MALE", "2012-05-14", "Sample address", "Maria Santos", "09171234567", "7", "Rizal"],
      ["STU-1002", "Ana", "", "Reyes", "FEMALE", "2012-09-03", "", "", "", "7", "Rizal"],
    ],
  },
  TEACHERS: {
    headers: ["Employee No", "First Name", "Middle Name", "Last Name", "Department", "Contact No"],
    sample: [
      ["EMP-1001", "Maria", "", "Dela Cruz", "Mathematics", "09171234567"],
      ["EMP-1002", "Jose", "Reyes", "Santos", "Science", ""],
    ],
  },
};

export function csvTemplate(type: ImportType): string {
  const template = templates[type];
  return `\uFEFF${writeCsv([template.headers, ...template.sample])}\r\n`;
}

export function rejectedRowsCsv(parsed: ParsedCsv, rows: ImportPreviewRow[]): string {
  const headers = ["Source row", ...parsed.headers, "Import errors"];
  const rejected = rows
    .filter((row) => row.errors.length)
    .map((row) => [
      row.rowNumber,
      ...row.raw,
      row.errors.map(({ field, message }) => `${field}: ${message}`).join("; "),
    ]);
  return `\uFEFF${writeCsv([headers, ...rejected])}\r\n`;
}
