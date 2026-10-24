import type { BuiltReport } from "./types.js";
import type { StudentReportFields } from "./shared.js";

export function buildClassRoster(students: readonly StudentReportFields[]): BuiltReport {
  return {
    columns: [
      { key: "number", label: "No." },
      { key: "studentNo", label: "Student No" },
      { key: "lastName", label: "Last Name" },
      { key: "firstName", label: "First Name" },
      { key: "middleName", label: "Middle Name" },
      { key: "sex", label: "Sex" },
    ],
    rows: students.map((student, index) => ({ number: index + 1, ...student })),
  };
}
