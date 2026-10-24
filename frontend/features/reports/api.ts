import { apiFetch, downloadApiFile } from "../../lib/api";
import type { ReportDefinition, ReportFilters, ReportPreview } from "../../types/reports";

export function fetchReportCatalog() {
  return apiFetch<ReportDefinition[]>("/api/reports");
}

export function fetchReportPreview(key: string, filters: ReportFilters) {
  const query = new URLSearchParams({ ...stringifyFilters(filters), preview: "true" });
  return apiFetch<ReportPreview>(`/api/reports/${encodeURIComponent(key)}?${query}`);
}

export async function downloadReportFile(key: string, filters: ReportFilters) {
  const query = new URLSearchParams(stringifyFilters(filters));
  const fallback = `${key}.csv`;
  return downloadApiFile(`/api/reports/${encodeURIComponent(key)}?${query}`, fallback);
}

function stringifyFilters(filters: ReportFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, String(value)]));
}
