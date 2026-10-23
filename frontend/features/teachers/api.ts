import { apiFetch } from "../../lib/api";
import type { TeacherDetail, TeacherInput, TeacherListParams, PaginatedTeachers, Teacher } from "./types";

export async function fetchTeachers(params: TeacherListParams): Promise<PaginatedTeachers> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  return apiFetch(`/api/teachers?${query}`);
}
export async function fetchTeacher(id: string): Promise<{ data: TeacherDetail }> {
  return apiFetch(`/api/teachers/${encodeURIComponent(id)}`);
}
export async function createTeacher(input: TeacherInput): Promise<{ data: Teacher }> {
  return apiFetch("/api/teachers", { method: "POST", body: JSON.stringify(input) });
}
export async function updateTeacher(id: string, input: Partial<Omit<TeacherInput, "employeeNo">>): Promise<{ data: Teacher }> {
  return apiFetch(`/api/teachers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function updateTeacherStatus(id: string, input: { isActive: boolean; reason?: string }) {
  return apiFetch<{ data: Teacher }>(`/api/teachers/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function createTeacherAccount(id: string, input: { email: string; temporaryPassword?: string }) {
  return apiFetch<{ data: { teacherId: string; user: { id: string; email: string; role: "TEACHER"; isActive: boolean }; temporaryPassword: string } }>(
    `/api/teachers/${encodeURIComponent(id)}/account`, { method: "POST", body: JSON.stringify(input) },
  );
}
