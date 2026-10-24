import type { ImportType } from "@prisma/client";
import type { ImportPreviewRow, StudentImportValues } from "./import.types.js";

function addError(row: ImportPreviewRow, field: string, message: string): void {
  row.errors.push({ field, message });
}

function addWarning(row: ImportPreviewRow, field: string, message: string): void {
  row.warnings.push({ field, message });
}

export function validateUniqueNumbers(
  rows: ImportPreviewRow[],
  type: ImportType,
  existingNumbers: ReadonlySet<string>,
): void {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = type === "STUDENTS" ? row.values.studentNo : row.values.employeeNo;
    const number = typeof value === "string" ? value : "";
    if (number) counts.set(number.toLocaleLowerCase(), (counts.get(number.toLocaleLowerCase()) ?? 0) + 1);
  }
  for (const row of rows) {
    const field = type === "STUDENTS" ? "studentNo" : "employeeNo";
    const value = type === "STUDENTS" ? row.values.studentNo : row.values.employeeNo;
    const number = typeof value === "string" ? value : "";
    if (!number) continue;
    if (existingNumbers.has(number.toLocaleLowerCase())) {
      addError(row, field, `${field === "studentNo" ? "Student" : "Employee"} number already exists`);
    } else if ((counts.get(number.toLocaleLowerCase()) ?? 0) > 1) {
      addError(row, field, `Duplicate ${field} appears more than once in this file`);
    }
  }
}

function identityKey(firstName: string, lastName: string, birthDate: string): string {
  return `${firstName.toLocaleLowerCase()}|${lastName.toLocaleLowerCase()}|${birthDate}`;
}

export function addPossibleDuplicateWarnings(
  rows: ImportPreviewRow[],
  existing: ReadonlyMap<string, string[]>,
): void {
  const firstInFile = new Map<string, string>();
  for (const row of rows) {
    if (!row.commitData || !("studentNo" in row.commitData)) continue;
    const values = row.commitData as StudentImportValues;
    const key = identityKey(values.firstName, values.lastName, values.birthDate);
    const matchNumbers = existing.get(key) ?? [];
    const earlierNumber = firstInFile.get(key);
    const matchNumber = matchNumbers[0] ?? earlierNumber;
    if (matchNumber && matchNumber !== values.studentNo) {
      addWarning(row, "studentNo", `Possible matching student found (${matchNumber})`);
    }
    if (!earlierNumber) firstInFile.set(key, values.studentNo);
  }
}

export function summarizeRows(rows: readonly ImportPreviewRow[]) {
  let warningRows = 0;
  let errorRows = 0;
  let validRows = 0;
  for (const row of rows) {
    if (row.errors.length) errorRows += 1;
    else if (row.warnings.length) warningRows += 1;
    else validRows += 1;
  }
  return { totalRows: rows.length, validRows, warningRows, errorRows };
}

export function rowStatus(row: Pick<ImportPreviewRow, "errors" | "warnings">): "VALID" | "WARNING" | "ERROR" {
  if (row.errors.length) return "ERROR";
  return row.warnings.length ? "WARNING" : "VALID";
}

export function printableRow(row: ImportPreviewRow) {
  const { commitData: _commitData, ...publicRow } = row;
  return { ...publicRow, status: rowStatus(row) };
}
