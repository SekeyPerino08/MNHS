import { ImportType } from "@prisma/client";
import type { ImportPreviewRow, RowIssue, TransformedRow } from "../import.types.js";

export function addIssue(row: TransformedRow, issue: RowIssue, warning = false): void {
  if (warning) {
    row.warnings.push(issue);
    if (row.status !== "ERROR") row.status = "WARNING";
  } else {
    row.errors.push(issue);
    row.status = "ERROR";
    row.normalized = null;
  }
}

export function validateInFileDuplicates(rows: TransformedRow[], type: ImportType): void {
  const seen = new Map<string, number>();
  const field = type === ImportType.STUDENTS ? "studentNo" : "employeeNo";
  for (const row of rows) {
    const value = row.pending[field];
    if (typeof value !== "string" || !value) continue;
    const key = value.toLocaleLowerCase();
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      addIssue(row, { field, message: `Duplicate of row ${firstRow} in this file` });
    } else {
      seen.set(key, row.rowNumber);
    }
  }
}

export function validateExistingNumbers(
  rows: TransformedRow[],
  type: ImportType,
  existing: ReadonlySet<string>,
): void {
  const field = type === ImportType.STUDENTS ? "studentNo" : "employeeNo";
  for (const row of rows) {
    const value = row.pending[field];
    if (typeof value === "string" && existing.has(value.toLocaleLowerCase())) {
      addIssue(row, { field, message: "Already exists" });
    }
  }
}

export function addPossibleDuplicateWarnings(
  rows: TransformedRow[],
  type: ImportType,
  existing: ReadonlyMap<string, string[]>,
): void {
  const seen = new Map<string, { number: string; rowNumber: number }>();
  for (const row of rows) {
    if (row.status === "ERROR") continue;
    const key = personKey(row, type);
    if (!key) continue;
    const number = type === ImportType.STUDENTS
      ? String(row.pending.studentNo)
      : String(row.pending.employeeNo);
    const matched = existing.get(key)?.[0] ?? seen.get(key)?.number;
    if (matched && matched.toLocaleLowerCase() !== number.toLocaleLowerCase()) {
      addIssue(row, { field: "person", message: `Possible duplicate of ${matched}` }, true);
    }
    if (!seen.has(key)) seen.set(key, { number, rowNumber: row.rowNumber });
  }
}

function personKey(row: TransformedRow, type: ImportType): string | null {
  const firstName = row.pending.firstName;
  const lastName = row.pending.lastName;
  if (typeof firstName !== "string" || typeof lastName !== "string") return null;
  if (type === ImportType.STUDENTS) {
    const birthDate = row.pending.birthDate;
    if (typeof birthDate !== "string") return null;
    return `${firstName.toLocaleLowerCase()}|${lastName.toLocaleLowerCase()}|${birthDate}`;
  }
  return `${firstName.toLocaleLowerCase()}|${lastName.toLocaleLowerCase()}`;
}

export function finalizeRows(rows: TransformedRow[]): ImportPreviewRow[] {
  return rows.map(({ pending: _pending, ...row }) => row);
}

export function summarizeRows(rows: readonly ImportPreviewRow[]) {
  return {
    totalRows: rows.length,
    validRows: rows.filter(({ status }) => status === "VALID").length,
    warningRows: rows.filter(({ status }) => status === "WARNING").length,
    errorRows: rows.filter(({ status }) => status === "ERROR").length,
  };
}
