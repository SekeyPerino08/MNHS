import type { ImportType } from "@prisma/client";

export type ImportField =
  | "studentNo"
  | "employeeNo"
  | "firstName"
  | "middleName"
  | "lastName"
  | "sex"
  | "birthDate"
  | "address"
  | "guardianName"
  | "guardianContact"
  | "department"
  | "contactNo"
  | "gradeLevel"
  | "section";

export interface RowIssue {
  field: string;
  message: string;
}

export interface ImportChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface ImportOptions {
  dateFormat: "ISO" | "MDY" | "DMY";
}

export interface EnrollmentPreview {
  sectionId: string;
  label: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  status: "ERROR" | "WARNING" | "VALID";
  errors: RowIssue[];
  warnings: RowIssue[];
  original: string[];
  normalized: Record<string, string | number | null> | null;
  changes: ImportChange[];
  enrollment?: EnrollmentPreview;
}

export interface ParsedRow {
  rowNumber: number;
  original: string[];
  errors: RowIssue[];
}

export interface ParsedCsv {
  delimiter: "," | ";";
  headers: string[];
  rows: ParsedRow[];
}

export interface HeaderMapping {
  recognized: Array<{ column: string; field: ImportField }>;
  ignored: string[];
  fields: Partial<Record<ImportField, number>>;
  hasGradeLevel: boolean;
  hasSection: boolean;
}

export interface TransformedRow extends ImportPreviewRow {
  normalized: Record<string, string | number | null> | null;
  pending: Record<string, string | number | null>;
}

export interface ImportRequestOptions extends ImportOptions {
  type: ImportType;
}
