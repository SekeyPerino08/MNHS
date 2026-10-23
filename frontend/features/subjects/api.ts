import { apiFetch } from "../../lib/api";
import type { Subject, SubjectInput, SubjectPage, SubjectParams } from "./types";
export async function fetchSubjects(params: SubjectParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  return apiFetch<SubjectPage>(`/api/subjects?${query}`);
}
export async function createSubject(input: SubjectInput) {
  return apiFetch<{ data: Subject }>("/api/subjects", { method: "POST", body: JSON.stringify(input) });
}
export async function updateSubject(id: string, input: Partial<SubjectInput>) {
  return apiFetch<{ data: Subject }>(`/api/subjects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function deleteSubject(id: string) {
  return apiFetch<void>(`/api/subjects/${encodeURIComponent(id)}`, { method: "DELETE" });
}
