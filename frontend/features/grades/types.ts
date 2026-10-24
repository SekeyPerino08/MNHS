export type GradeValue = number | null;

export interface GradeTermSummary {
  id: string;
  name: string;
  order: number;
  gradesLocked: boolean;
}

export interface GradeRow {
  studentId: string;
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  scores: Record<string, GradeValue>;
  remarks: Record<string, string | null>;
  finalGrade: number | null;
  descriptor: string | null;
  passing: boolean | null;
}

export interface ClassGradeSheet {
  classOfferingId: string;
  subject: { id: string; code: string; name: string };
  section: { id: string; name: string; gradeLevel: number };
  teacher: { id: string; firstName: string; lastName: string };
  terms: GradeTermSummary[];
  roster: GradeRow[];
  editableTermIds: string[];
}

export interface StudentGradeTerm {
  id: string;
  name: string;
  order: number;
  locked: boolean;
  score: number | null;
  descriptor: string | null;
}

export interface StudentGradeSubject {
  id: string;
  code: string;
  name: string;
  sectionName: string;
  teacherName: string;
  terms: StudentGradeTerm[];
  finalGrade: number | null;
  descriptor: string | null;
  passing: boolean | null;
  generalAverage: number | null;
}

export interface StudentGradesResponse {
  schoolYear: { id: string; name: string };
  generalAverage: number | null;
  subjects: StudentGradeSubject[];
}
