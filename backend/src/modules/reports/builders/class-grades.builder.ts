import { calculateFinalGrade, getGradeDescriptor, isPassing } from "../../../utils/grading.js";
import type { BuiltReport } from "./types.js";
import type { StudentReportFields } from "./shared.js";

export interface GradeStudent extends StudentReportFields {
  id: string;
}

export interface GradeTerm {
  id: string;
  termNumber: number;
}

export interface ClassGradeRecord {
  studentId: string;
  termId: string;
  score: number;
  remarks: string | null;
}

export function buildClassGrades(
  students: readonly GradeStudent[],
  terms: readonly GradeTerm[],
  grades: readonly ClassGradeRecord[],
): BuiltReport {
  const orderedTerms = [...terms].sort((left, right) => left.termNumber - right.termNumber).slice(0, 4);
  const gradeMap = new Map(grades.map((grade) => [`${grade.studentId}:${grade.termId}`, grade]));
  const quarterColumns = [1, 2, 3, 4].map((quarter) => ({ key: `q${quarter}`, label: `Q${quarter}` }));
  const columns = [
    { key: "studentNo", label: "Student No" },
    { key: "lastName", label: "Last Name" },
    { key: "firstName", label: "First Name" },
    ...quarterColumns,
    { key: "finalGrade", label: "Final Grade" },
    { key: "descriptor", label: "Descriptor" },
    { key: "remarks", label: "Remarks" },
  ];
  const rows = students.map((student) => {
    const quarters: Array<number | null> = [null, null, null, null];
    orderedTerms.forEach((term) => {
      if (term.termNumber < 1 || term.termNumber > 4) return;
      const grade = gradeMap.get(`${student.id}:${term.id}`);
      if (grade) quarters[term.termNumber - 1] = grade.score;
    });
    const finalGrade = calculateFinalGrade(quarters);
    const remarks = finalGrade === null ? null : isPassing(finalGrade) ? "Passed" : "Below 75";
    return {
      studentNo: student.studentNo,
      lastName: student.lastName,
      firstName: student.firstName,
      q1: quarters[0],
      q2: quarters[1],
      q3: quarters[2],
      q4: quarters[3],
      finalGrade,
      descriptor: getGradeDescriptor(finalGrade),
      remarks,
    };
  });
  return { columns, rows };
}
