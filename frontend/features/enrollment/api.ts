import { apiFetch } from "../../lib/api";
import type {
  EnrollmentListParams,
  EnrollmentsPage,
  UnassignedParams,
  UnassignedStudentsPage,
} from "./types";

function queryString(params: object) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function fetchEnrollments(params: EnrollmentListParams) {
  return apiFetch<EnrollmentsPage>(`/api/enrollments?${queryString(params)}`);
}

export function fetchUnassignedStudents(params: UnassignedParams) {
  return apiFetch<UnassignedStudentsPage>(`/api/enrollments/unassigned?${queryString(params)}`);
}

export async function createEnrollment(input: { studentId: string; sectionId: string }) {
  return apiFetch<{ data: unknown }>("/api/enrollments", { method: "POST", body: JSON.stringify(input) });
}

export async function bulkEnroll(input: { sectionId: string; studentIds: string[] }) {
  return apiFetch<{
    enrolled: Array<{ id: string; studentId: string }>;
    skipped: Array<{ studentId: string; reason: string; code?: string }>;
  }>("/api/enrollments/bulk", { method: "POST", body: JSON.stringify(input) });
}

export function transferEnrollment(id: string, sectionId: string) {
  return apiFetch<{ data: unknown }>(`/api/enrollments/${encodeURIComponent(id)}/transfer`, {
    method: "PATCH",
    body: JSON.stringify({ sectionId }),
  });
}

export function updateEnrollmentStatus(id: string, input: { status: "ENROLLED" | "DROPPED" | "COMPLETED"; reason?: string }) {
  return apiFetch<{ data: unknown }>(`/api/enrollments/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
