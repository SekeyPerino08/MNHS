export interface ReportCardTerm {
  id: string;
  name: string;
  order: number;
  released: boolean;
}

export interface ReportCardQuarter {
  termId: string;
  order: number;
  score: number | null;
  released: boolean;
}

export interface ReportCardSubject {
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  quarters: ReportCardQuarter[];
  finalGrade: number | null;
  descriptor: string | null;
  passing: boolean | null;
}

export interface ReportCardAttendanceTerm {
  termId: string;
  order: number;
  released: boolean;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number | null;
}

export interface ReportCard {
  student: {
    id: string;
    studentNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    sex: string;
    birthDate: string | null;
  };
  schoolYear: { id: string; name: string };
  section: { gradeLevel: number; name: string };
  adviser: { firstName: string; lastName: string; middleName?: string | null } | null;
  enrollmentStatus: string;
  terms: ReportCardTerm[];
  subjects: ReportCardSubject[];
  generalAverage: number | null;
  summary: {
    subjectCount: number;
    subjectsWithFinalGrade: number;
    subjectsPassed: number;
    subjectsFailed: number;
    allSubjectsPassed: boolean | null;
  };
  attendance: {
    terms: ReportCardAttendanceTerm[];
    overall: {
      present: number;
      absent: number;
      late: number;
      excused: number;
      rate: number | null;
    };
  };
  generatedAt: string;
  isDraft: boolean;
}

export interface ReportCardYear {
  id: string;
  name: string;
}
