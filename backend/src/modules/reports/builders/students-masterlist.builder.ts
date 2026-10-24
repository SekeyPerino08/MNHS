import { formatDateString, todayInManila } from "../../../utils/dates.js";
import { ageAsOf } from "./shared.js";
import type { BuiltReport } from "./types.js";

export interface MasterlistStudent {
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: string;
  birthDate: Date | null;
  status: string;
  userId: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  address: string | null;
  enrollments: Array<{
    status: string;
    section: { gradeLevel: number; name: string } | null;
  }>;
}

export function buildStudentsMasterlist(
  students: readonly MasterlistStudent[],
  includeContact: boolean,
  asOf = todayInManila(),
): BuiltReport {
  const columns = [
    { key: "studentNo", label: "Student No" },
    { key: "lastName", label: "Last Name" },
    { key: "firstName", label: "First Name" },
    { key: "middleName", label: "Middle Name" },
    { key: "sex", label: "Sex" },
    { key: "birthDate", label: "Birth Date" },
    { key: "age", label: "Age" },
    { key: "status", label: "Status" },
    { key: "gradeLevel", label: "Grade Level" },
    { key: "section", label: "Section" },
    { key: "enrollmentStatus", label: "Enrollment Status" },
    { key: "hasLogin", label: "Has Login" },
    ...(includeContact ? [
      { key: "guardianName", label: "Guardian Name" },
      { key: "guardianContact", label: "Guardian Contact" },
      { key: "address", label: "Address" },
    ] : []),
  ];
  const rows = students.map((student) => {
    const enrollment = student.enrollments[0];
    const row = {
      studentNo: student.studentNo,
      lastName: student.lastName,
      firstName: student.firstName,
      middleName: student.middleName,
      sex: student.sex,
      birthDate: student.birthDate ? formatDateString(student.birthDate) : null,
      age: ageAsOf(student.birthDate, asOf),
      status: student.status,
      gradeLevel: enrollment?.section?.gradeLevel ?? null,
      section: enrollment?.section?.name ?? null,
      enrollmentStatus: enrollment?.status ?? "UNASSIGNED",
      hasLogin: student.userId ? "Yes" : "No",
      ...(includeContact ? {
        guardianName: student.guardianName,
        guardianContact: student.guardianContact,
        address: student.address,
      } : {}),
    };
    return row;
  });
  return { columns, rows };
}
