export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  gradeLevel: number;
  createdAt: string;
  updatedAt: string;
  _count?: { classOfferings: number };
}
export interface SubjectParams {
  page: number; pageSize: number; search?: string; gradeLevel?: number;
  sortBy: "code" | "name"; order: "asc" | "desc";
}
export interface SubjectPage {
  data: Subject[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface SubjectInput { code: string; name: string; description?: string | null; gradeLevel: number }
