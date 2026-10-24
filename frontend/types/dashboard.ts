export interface DashboardContext {
  schoolYear: { id: string; name: string };
  currentTerm: { id: string; name: string; order: number; gradesLocked: boolean } | null;
  currentTermSource: "contains_today" | "most_recent" | "first" | null;
  today: string;
}

export interface AdminDashboardData {
  context: DashboardContext | null;
  counts: {
    activeStudents: number;
    enrolledStudents: number;
    unassignedStudents: number;
    activeTeachers: number;
    sections: number;
    classOfferings: number;
    accountsWithoutLogin: { students: number; teachers: number };
  };
  enrollmentByGrade: { gradeLevel: number; sections: number; students: number }[];
  sectionSizes: {
    sectionId: string;
    label: string;
    gradeLevel: number;
    students: number;
    adviserName: string | null;
  }[];
  attendanceTrend: {
    date: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
  }[];
  attendanceToday: { classesWithRecords: number; classesExpected: number; rate: number | null };
  gradeProgress: {
    gradedEntries: number;
    expectedEntries: number;
    percentComplete: number;
    incompleteClasses: number;
    locked: boolean;
  };
  needsAttention: {
    id: string;
    severity: "warning" | "info";
    message: string;
    count: number;
    href: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actor: { email: string; role: string } | null;
  }[];
}

export interface TeacherDashboardData {
  context: DashboardContext | null;
  counts: {
    classes: number;
    studentsTotal: number;
    advisorySection: { id: string; label: string; students: number } | null;
  };
  classes: {
    classOfferingId: string;
    subjectName: string;
    sectionLabel: string;
    students: number;
    attendanceToday: { recorded: boolean; present: number; absent: number; late: number; excused: number };
    attendanceRate: number | null;
    gradesCurrentTerm: { graded: number; expected: number; locked: boolean };
  }[];
  attendancePending: { count: number; classOfferingIds: string[] };
  atRisk: {
    studentId: string;
    studentNo: string;
    name: string;
    classOfferingId: string;
    subjectName: string;
    rate: number;
  }[];
  gradeDistribution: {
    "90-100": number;
    "85-89": number;
    "80-84": number;
    "75-79": number;
    below75: number;
  };
}

export interface StudentDashboardData {
  context: DashboardContext | null;
  enrollment: { sectionLabel: string; gradeLevel: number; adviserName: string | null } | null;
  attendance: {
    overallRate: number | null;
    currentTermRate: number | null;
    counts: { present: number; absent: number; late: number; excused: number };
    recentAbsences: { date: string; subjectName: string; status: "ABSENT" | "LATE" }[];
  };
  grades: {
    releasedTerms: number;
    generalAverage: number | null;
    subjectsPassed: number;
    subjectsBelowPassing: number;
    latestReleasedTerm: { name: string; average: number | null } | null;
  };
  reportCardAvailable: boolean;
}

export interface DashboardTableColumn {
  key: string;
  label: string;
}

export type DashboardTableRow = Record<string, string | number | null>;
