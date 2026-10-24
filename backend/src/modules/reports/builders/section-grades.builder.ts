import { calculateGeneralAverage } from "../../../utils/grading.js";
import type { BuiltReport } from "./types.js";

export interface SectionGradeStudent {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
}

export interface SectionGradeSubject {
  id: string;
  code: string;
}

export interface SectionGradeRecord {
  studentId: string;
  classOfferingId: string;
  score: number;
}

export function buildSectionGrades(
  students: readonly SectionGradeStudent[],
  subjects: readonly SectionGradeSubject[],
  grades: readonly SectionGradeRecord[],
): BuiltReport {
  const gradeMap = new Map(grades.map((grade) => [`${grade.studentId}:${grade.classOfferingId}`, grade.score]));
  const columns = [
    { key: "studentNo", label: "Student No" },
    { key: "lastName", label: "Last Name" },
    { key: "firstName", label: "First Name" },
    ...subjects.map((subject) => ({ key: `subject_${subject.id}`, label: subject.code })),
    { key: "generalAverage", label: "General Average" },
  ];
  const rows = students.map((student) => {
    const subjectValues = subjects.map((subject) => gradeMap.get(`${student.id}:${subject.id}`) ?? null);
    return {
      studentNo: student.studentNo,
      lastName: student.lastName,
      firstName: student.firstName,
      ...Object.fromEntries(subjects.map((subject, index) => [`subject_${subject.id}`, subjectValues[index]])),
      generalAverage: calculateGeneralAverage(subjectValues),
    };
  });
  return { columns, rows };
}
