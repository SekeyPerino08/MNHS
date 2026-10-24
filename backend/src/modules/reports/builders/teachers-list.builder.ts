import type { BuiltReport } from "./types.js";

export interface TeacherReportRecord {
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  department: string | null;
  isActive: boolean;
  userId: string | null;
  classCount: number;
  advisorySection: string | null;
}

export function buildTeachersList(teachers: readonly TeacherReportRecord[]): BuiltReport {
  return {
    columns: [
      { key: "employeeNo", label: "Employee No" },
      { key: "lastName", label: "Last Name" },
      { key: "firstName", label: "First Name" },
      { key: "middleName", label: "Middle Name" },
      { key: "department", label: "Department" },
      { key: "status", label: "Status" },
      { key: "hasLogin", label: "Has Login" },
      { key: "classes", label: "Classes" },
      { key: "advisorySection", label: "Advisory Section" },
    ],
    rows: teachers.map((teacher) => ({
      employeeNo: teacher.employeeNo,
      lastName: teacher.lastName,
      firstName: teacher.firstName,
      middleName: teacher.middleName,
      department: teacher.department,
      status: teacher.isActive ? "Active" : "Inactive",
      hasLogin: teacher.userId ? "Yes" : "No",
      classes: teacher.classCount,
      advisorySection: teacher.advisorySection,
    })),
  };
}
