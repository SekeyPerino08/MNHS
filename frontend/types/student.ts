export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED" | "DROPPED";
export type Sex = "MALE" | "FEMALE";

export interface Student {
  id: string;
  studentNo: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: Sex;
  birthDate: string | null;
  address: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentSummary {
  section: { id: string; name: string; gradeLevel: number } | null;
  schoolYear: { id: string; name: string };
}

export interface StudentListItem extends Student {
  currentEnrollment: EnrollmentSummary | null;
}

export interface StudentDetail extends Student {
  user: { email: string; isActive?: boolean } | null;
  currentEnrollment: (EnrollmentSummary & { status?: string }) | null;
  enrollments: Array<{
    id: string;
    status: string;
    enrolledAt: string;
    section: { id: string; name: string; gradeLevel: number } | null;
    schoolYear: { id: string; name: string; isCurrent?: boolean };
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface StudentListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: StudentStatus;
  gradeLevel?: number;
  sortBy: "lastName" | "firstName" | "studentNo" | "createdAt";
  order: "asc" | "desc";
}

export interface StudentInput {
  studentNo: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  sex: Sex;
  birthDate: string;
  address?: string | null;
  guardianName?: string | null;
  guardianContact?: string | null;
  confirmDuplicate?: boolean;
}
