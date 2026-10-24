import type { BuiltReport } from "./types.js";
import type { StudentReportFields } from "./shared.js";

export function buildSectionClassList(students: readonly StudentReportFields[]): BuiltReport {
  const columns = [
    { key: "number", label: "No." },
    { key: "studentNo", label: "Student No" },
    { key: "lastName", label: "Last Name" },
    { key: "firstName", label: "First Name" },
    { key: "middleName", label: "Middle Name" },
    { key: "sex", label: "Sex" },
  ];
  return {
    columns,
    rows: students.map((student, index) => ({ number: index + 1, ...student })),
  };
}
