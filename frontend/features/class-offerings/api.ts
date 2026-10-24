import { apiFetch } from "../../lib/api";
import type { ClassOfferingRecord, ClassOfferingsPage, MyClassesData } from "../enrollment/types";

function queryString(params: object) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.toString();
}

export function fetchClassOfferings(params: {
  page: number;
  pageSize: number;
  schoolYearId?: string;
  sectionId?: string;
  teacherId?: string;
  subjectId?: string;
  gradeLevel?: number;
}) {
  return apiFetch<ClassOfferingsPage>(`/api/class-offerings?${queryString(params)}`);
}

export function createClassOffering(input: { sectionId: string; subjectId: string; teacherId: string }) {
  return apiFetch<{ data: ClassOfferingRecord }>("/api/class-offerings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function bulkCreateClassOfferings(input: {
  sectionId: string;
  items: Array<{ subjectId: string; teacherId: string }>;
}) {
  return apiFetch<{ created: ClassOfferingRecord[]; skipped: Array<{ subjectId: string; teacherId: string; reason: string; code?: string }> }>(
    "/api/class-offerings/bulk",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateClassOffering(id: string, teacherId: string) {
  return apiFetch<{ data: ClassOfferingRecord }>(`/api/class-offerings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ teacherId }),
  });
}

export function deleteClassOffering(id: string) {
  return apiFetch<void>(`/api/class-offerings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function fetchMyClasses(schoolYearId?: string) {
  const query = schoolYearId ? `?schoolYearId=${encodeURIComponent(schoolYearId)}` : "";
  return apiFetch<MyClassesData>(`/api/me/classes${query}`);
}

export function fetchMyEnrollment() {
  return apiFetch<import("../enrollment/types").MyEnrollmentData>("/api/me/enrollment");
}

export function fetchClassOffering(id: string) {
  return apiFetch<{ data: ClassOfferingRecord }>(`/api/class-offerings/${encodeURIComponent(id)}`);
}

export function fetchOfferingStudents(id: string) {
  return apiFetch<{ data: Array<{ id: string; studentNo: string; firstName: string; middleName: string | null; lastName: string; sex: "MALE" | "FEMALE" }> }>(
    `/api/class-offerings/${encodeURIComponent(id)}/students`,
  );
}
