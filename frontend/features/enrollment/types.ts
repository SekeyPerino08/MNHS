import type { Sex, StudentStatus } from "../../types/student";

export type EnrollmentState = "ENROLLED" | "DROPPED" | "COMPLETED";
export type EnrollmentStatus = EnrollmentState;

export interface EnrollmentStudent {
  id: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex?: Sex;
  status?: StudentStatus;
}

export interface EnrollmentSection {
  id: string;
  name: string;
  gradeLevel: number;
}

export interface EnrollmentRecord {
  id: string;
  studentId: string;
  schoolYearId: string;
  sectionId: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  student: EnrollmentStudent;
  section: EnrollmentSection | null;
  schoolYear?: { id: string; name: string; isCurrent?: boolean };
}

export interface UnassignedStudent extends EnrollmentStudent {
  sex: Sex;
  status: StudentStatus;
}

export interface EnrollmentsPage {
  data: EnrollmentRecord[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface UnassignedStudentsPage {
  data: UnassignedStudent[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface EnrollmentListParams {
  page: number;
  pageSize: number;
  schoolYearId?: string;
  sectionId?: string;
  gradeLevel?: number;
  status?: EnrollmentState;
  search?: string;
  sortBy: "enrolledAt" | "studentNo" | "lastName" | "status";
  order: "asc" | "desc";
}

export interface UnassignedParams {
  page: number;
  pageSize: number;
  schoolYearId?: string;
  search?: string;
}

export interface ClassOfferingRecord {
  id: string;
  subjectId: string;
  sectionId: string;
  teacherId: string;
  schoolYearId: string;
  subject: { id: string; code: string; name: string; gradeLevel: number };
  section: { id: string; name: string; gradeLevel: number };
  teacher: { id: string; employeeNo?: string; firstName: string; middleName?: string | null; lastName: string; department?: string | null };
  enrolledStudentCount?: number;
}

export interface ClassOfferingsPage {
  data: ClassOfferingRecord[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface MyClassesData {
  data: Array<ClassOfferingRecord & { enrolledStudentCount: number }>;
  advisedSection: (EnrollmentSection & { schoolYear?: { id: string; name: string } }) | null;
}

export interface MyEnrollmentData {
  enrollment: null | {
    id: string;
    status: EnrollmentState;
    enrolledAt: string;
    section: (EnrollmentSection & {
      adviser: { id: string; firstName: string; middleName: string | null; lastName: string } | null;
    }) | null;
    schoolYear: { id: string; name: string; isCurrent: boolean };
  };
  classOfferings: Array<{
    id: string;
    subject: { id: string; code: string; name: string; gradeLevel: number };
    teacher: { id: string; firstName: string; middleName: string | null; lastName: string };
  }>;
}
