export interface ReportColumn {
  key: string;
  label: string;
}

export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;

export interface BuiltReport {
  columns: ReportColumn[];
  rows: ReportRow[];
}
