export interface Teacher {
  id: string;
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  department: string | null;
  contactNo: string | null;
  isActive: boolean;
  userId?: string | null;
  hasAccount?: boolean;
  classOfferingCount?: number;
  advisedSectionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TeacherListItem extends Teacher {
  hasAccount: boolean;
  classOfferingCount: number;
  advisedSectionCount: number;
}

export interface TeacherOffering {
  id: string;
  subject: { id: string; code: string; name: string; gradeLevel: number };
  section: { id: string; name: string; gradeLevel: number };
  term: { id: string; name: string; termNumber: number };
}

export interface TeacherDetail extends Teacher {
  user: { email: string } | null;
  offerings: TeacherOffering[];
  advisedSections: Array<{ id: string; name: string; gradeLevel: number }>;
}

export interface TeacherInput {
  employeeNo: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  department?: string | null;
  contactNo?: string | null;
}

export interface TeacherListParams {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
  sortBy: "lastName" | "employeeNo" | "createdAt";
  order: "asc" | "desc";
}

export interface PaginatedTeachers {
  data: TeacherListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
