import { apiFetch } from "../../lib/api";
import type {
  PaginatedResponse,
  Student,
  StudentDetail,
  StudentInput,
  StudentListItem,
  StudentListParams,
  StudentStatus,
} from "../../types/student";

export async function fetchStudents(params: StudentListParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return apiFetch<PaginatedResponse<StudentListItem>>(`/api/students?${search.toString()}`);
}

export async function fetchStudent(id: string) {
  return apiFetch<StudentDetail>(`/api/students/${encodeURIComponent(id)}`);
}

export async function createStudent(input: StudentInput) {
  const response = await apiFetch<{ data: Student }>("/api/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateStudent(id: string, input: Partial<Omit<StudentInput, "studentNo" | "confirmDuplicate">>) {
  const response = await apiFetch<{ data: Student }>(`/api/students/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateStudentStatus(
  id: string,
  input: { status: StudentStatus; reason?: string },
) {
  const response = await apiFetch<{ data: Student }>(`/api/students/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export interface StudentAccountResult {
  studentId: string;
  user: { id: string; email: string; role: "STUDENT"; isActive: boolean };
  temporaryPassword: string;
}

export async function createStudentAccount(
  id: string,
  input: { email: string; temporaryPassword?: string },
): Promise<StudentAccountResult> {
  const response = await apiFetch<{ data: StudentAccountResult }>(
    `/api/students/${encodeURIComponent(id)}/account`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.data;
}
