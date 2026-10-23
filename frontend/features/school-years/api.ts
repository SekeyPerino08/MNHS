import { apiFetch } from "../../lib/api";
import type { SchoolYear, SchoolYearInput, Term, TermInput } from "./types";
export async function fetchSchoolYears() {
  return apiFetch<{ data: SchoolYear[] }>("/api/school-years");
}
export async function fetchCurrentSchoolYear() {
  return apiFetch<{ data: SchoolYear }>("/api/school-years/current");
}
export async function createSchoolYear(input: SchoolYearInput) {
  return apiFetch<{ data: SchoolYear }>("/api/school-years", { method: "POST", body: JSON.stringify(input) });
}
export async function updateSchoolYear(id: string, input: Partial<SchoolYearInput>) {
  return apiFetch<{ data: SchoolYear }>(`/api/school-years/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function setCurrentSchoolYear(id: string) {
  return apiFetch<{ data: SchoolYear }>(`/api/school-years/${encodeURIComponent(id)}/set-current`, { method: "PATCH" });
}
export async function updateTerm(schoolYearId: string, termId: string, input: TermInput) {
  return apiFetch<{ data: Term }>(`/api/school-years/${encodeURIComponent(schoolYearId)}/terms/${encodeURIComponent(termId)}`, { method: "PATCH", body: JSON.stringify(input) });
}
