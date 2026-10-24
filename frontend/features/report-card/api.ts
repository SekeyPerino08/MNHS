import { apiFetch } from "../../lib/api";
import type { ReportCard, ReportCardYear } from "../../types/report-card";

function queryString(params: Record<string, string | number | boolean | undefined>) {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.set(key, String(value));
  }
  return url.toString();
}

export function fetchMyReportCard(schoolYearId?: string) {
  const query = schoolYearId ? `?${queryString({ schoolYearId })}` : "";
  return apiFetch<ReportCard>(`/api/me/report-card${query}`);
}

export function fetchMyReportCardYears() {
  return apiFetch<ReportCardYear[]>("/api/me/report-card/available-years");
}

export function fetchStudentReportCard(studentId: string, schoolYearId?: string, includeUnreleased = false) {
  const query = queryString({ schoolYearId, includeUnreleased });
  return apiFetch<ReportCard>(`/api/students/${encodeURIComponent(studentId)}/report-card${query ? `?${query}` : ""}`);
}

export function fetchSectionReportCards(sectionId: string, includeUnreleased = false) {
  const query = queryString({ includeUnreleased });
  return apiFetch<ReportCard[]>(`/api/sections/${encodeURIComponent(sectionId)}/report-cards${query ? `?${query}` : ""}`);
}
