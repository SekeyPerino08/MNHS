import { apiFetch } from "../../lib/api";
import type { ClassGradeSheet, StudentGradesResponse } from "./types";

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function fetchClassGradeSheet(classOfferingId: string) {
  return apiFetch<ClassGradeSheet>(`/api/class-offerings/${encodeURIComponent(classOfferingId)}/grades`);
}

export function fetchMyGrades(params: { schoolYearId?: string } = {}) {
  return apiFetch<StudentGradesResponse>(`/api/me/grades?${queryString(params)}`);
}
