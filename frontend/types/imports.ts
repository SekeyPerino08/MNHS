export type ImportType = "STUDENTS" | "TEACHERS";
export type ImportDateFormat = "ISO" | "MDY" | "DMY";
export type ImportRowStatus = "VALID" | "WARNING" | "ERROR";
export type ImportRowFilter = "ALL" | ImportRowStatus;
export type ImportJobStatus = "PREVIEWED" | "COMMITTED" | "DISCARDED" | "EXPIRED";

export interface ImportIssue {
  field: string;
  message: string;
}

export interface ImportChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ImportRow {
  rowNumber: number;
  status: ImportRowStatus;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  original: Record<string, unknown>;
  normalized: Record<string, unknown>;
  changes: ImportChange[];
  enrollment?: { label: string };
}

export interface ImportTotals {
  rows: number;
  valid: number;
  warnings: number;
  errors: number;
}

export interface PreviousImport {
  at: string;
  by: string;
}

export interface ImportJob {
  id?: string;
  jobId?: string;
  type: ImportType;
  fileName: string;
  expiresAt: string;
  columns: { recognized: string[]; ignored: string[] };
  totals: ImportTotals;
  willEnroll: boolean;
  previouslyImported: PreviousImport | null;
  status?: ImportJobStatus;
  createdAt?: string;
  committedAt?: string | null;
}

export interface ImportRowsPage {
  data: ImportRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ImportHistoryItem {
  id: string;
  type: ImportType;
  fileName: string;
  status: ImportJobStatus;
  totals: ImportTotals;
  result?: ImportResult | null;
  createdBy?: { id?: string; email: string } | string | null;
  createdAt: string;
  committedAt?: string | null;
  expiresAt?: string | null;
}

export interface ImportHistoryPage {
  data: ImportHistoryItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ImportResult {
  created: number;
  enrolled: number;
  skippedWarnings: number;
  skippedErrors: number;
}

export interface ImportCommitOptions {
  includeWarnings: boolean;
}
