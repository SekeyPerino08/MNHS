export interface ReportFilterDefinition {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  filters: ReportFilterDefinition[];
}

export interface ReportColumn {
  key: string;
  label: string;
}

export type ReportCell = string | number | null;

export interface ReportPreview {
  report: string;
  filters: Record<string, string | boolean>;
  total: number;
  columns: ReportColumn[];
  rows: Array<Record<string, ReportCell>>;
  generatedAt: string;
}

export type ReportFilters = Record<string, string | boolean>;
