import { EnrollmentStatus, Prisma, Role, type AttendanceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { calculateAttendanceRate } from "../attendance/attendance.rules.js";
import { calculateFinalGrade, calculateGeneralAverage, getGradeDescriptor, isPassing } from "../../utils/grading.js";
import { formatDateString, todayInManila } from "../../utils/dates.js";
import { reportCardQuerySchema, sectionReportCardsQuerySchema } from "./report-cards.schema.js";

export interface ReportCardUser {
  id: string;
  role: Role;
}

export interface ReportCardTerm {
  id: string;
  name: string;
  order: number;
  released: boolean;
}

export interface ReportCardSubjectQuarter {
  termId: string;
  order: number;
  score: number | null;
  released: boolean;
}

export interface ReportCardSubject {
  subjectCode: string;
  subjectName: string;
  teacherName: string;
  quarters: ReportCardSubjectQuarter[];
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

export interface ReportCardAttendanceSummary {
  terms: ReportCardAttendanceTerm[];
  overall: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
  };
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
  adviser: { firstName: string; lastName: string } | null;
  enrollmentStatus: EnrollmentStatus;
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
  attendance: ReportCardAttendanceSummary;
  generatedAt: string;
  isDraft: boolean;
}

interface ParsedQuery {
  schoolYearId?: string;
  includeUnreleased?: boolean;
}

function parseQuery<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  return parsed.data;
}

function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

function normalizeAttendanceCounts() {
  return { present: 0, absent: 0, late: 0, excused: 0 };
}

function addAttendanceCounts(
  counts: ReturnType<typeof normalizeAttendanceCounts>,
  status: AttendanceStatus,
  amount: number,
): void {
  switch (status) {
    case "PRESENT": counts.present += amount; break;
    case "ABSENT": counts.absent += amount; break;
    case "LATE": counts.late += amount; break;
    case "EXCUSED": counts.excused += amount; break;
  }
}

async function resolveSchoolYearId(schoolYearId?: string): Promise<string> {
  if (schoolYearId) {
    const year = await prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } });
    if (!year) throw new AppError("School year not found", 404);
    return year.id;
  }
  const current = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return current.id;
}

export async function assertCanViewReportCard(user: ReportCardUser, studentId: string, schoolYearId: string): Promise<void> {
  if (user.role === Role.ADMIN) return;

  if (user.role === Role.STUDENT) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student || student.userId !== user.id) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, schoolYearId, status: EnrollmentStatus.ENROLLED },
      select: { id: true },
    });
    if (!enrollment) throw new AppError("No enrollment found", 404, "NO_ENROLLMENT");
    return;
  }

  if (user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!teacher) throw new AppError("Forbidden", 403, "FORBIDDEN");
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        schoolYearId,
        status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.DROPPED, EnrollmentStatus.COMPLETED] },
        section: { adviserId: teacher.id },
      },
      select: { id: true },
    });
    if (!enrollment) throw new AppError("Forbidden", 403, "FORBIDDEN");
    return;
  }

  throw new AppError("Forbidden", 403, "FORBIDDEN");
}

function getTeacherDisplayName(teacher: { firstName: string; middleName?: string | null; lastName: string } | null): string | null {
  if (!teacher) return null;
  return `${teacher.firstName} ${teacher.middleName ? `${teacher.middleName} ` : ""}${teacher.lastName}`.trim();
}

function buildSummary(subjects: ReportCardSubject[]) {
  const subjectCount = subjects.length;
  const subjectsWithFinalGrade = subjects.filter((subject) => subject.finalGrade !== null).length;
  const subjectsPassed = subjects.filter((subject) => subject.passing === true).length;
  const subjectsFailed = subjects.filter((subject) => subject.finalGrade !== null && subject.passing === false).length;
  const allSubjectsPassed = subjectCount > 0 && subjectsWithFinalGrade === subjectCount
    ? subjects.every((subject) => subject.passing === true)
    : null;

  return {
    subjectCount,
    subjectsWithFinalGrade,
    subjectsPassed,
    subjectsFailed,
    allSubjectsPassed,
  };
}

function buildAttendanceSummary(
  terms: Array<{ id: string; name: string; termNumber: number; gradesLocked: boolean; startDate: Date; endDate: Date }>,
  sectionId: string,
  studentId: string,
  attendanceRows: Array<{ studentId: string; classOfferingId: string; date: Date; status: AttendanceStatus; classOffering: { sectionId: string } }>,
  today: Date,
): ReportCardAttendanceSummary {
  const termSummaries = terms.map((term) => {
    const counts = normalizeAttendanceCounts();
    for (const row of attendanceRows) {
      if (row.studentId !== studentId || row.classOffering.sectionId !== sectionId) continue;
      if (row.date < term.startDate || row.date > term.endDate || row.date > today) continue;
      addAttendanceCounts(counts, row.status, 1);
    }
    return {
      termId: term.id,
      order: term.termNumber,
      released: term.gradesLocked,
      ...counts,
      rate: calculateAttendanceRate(counts),
    };
  });

  const overallCounts = normalizeAttendanceCounts();
  for (const row of attendanceRows) {
    if (row.studentId !== studentId || row.classOffering.sectionId !== sectionId) continue;
    if (row.date > today) continue;
    addAttendanceCounts(overallCounts, row.status, 1);
  }

  return {
    terms: termSummaries,
    overall: {
      ...overallCounts,
      rate: calculateAttendanceRate(overallCounts),
    },
  };
}

function buildVisibleQuarter(
  term: { id: string; termNumber: number; gradesLocked: boolean },
  score: number | null,
  includeUnreleased: boolean,
): ReportCardSubjectQuarter {
  const visibleScore = term.gradesLocked || includeUnreleased ? score : null;
  return {
    termId: term.id,
    order: term.termNumber,
    score: visibleScore,
    released: term.gradesLocked,
  };
}

// Single-card and batch-card endpoints intentionally share this assembly path so both produce the exact same values.
export function assembleReportCardFromData({
  student,
  enrollment,
  schoolYear,
  section,
  adviser,
  terms,
  classOfferings,
  gradeRows,
  attendanceRows,
  includeUnreleased,
}: {
  student: {
    id: string;
    studentNo: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    sex: string;
    birthDate: Date | null;
  };
  enrollment: { status: EnrollmentStatus };
  schoolYear: { id: string; name: string };
  section: { id: string; gradeLevel: number; name: string };
  adviser: { firstName: string; lastName: string; middleName?: string | null } | null;
  terms: Array<{ id: string; name: string; termNumber: number; gradesLocked: boolean; startDate: Date; endDate: Date }>;
  classOfferings: Array<{ id: string; subject: { code: string; name: string }; teacher: { firstName: string; middleName?: string | null; lastName: string } }>;
  gradeRows: Array<{ classOfferingId: string; termId: string; score: Prisma.Decimal | number | null }>;
  attendanceRows: Array<{ studentId: string; classOfferingId: string; date: Date; status: AttendanceStatus; classOffering: { sectionId: string } }>;
  includeUnreleased: boolean;
}): ReportCard {
  const gradeMap = new Map<string, number | null>();
  for (const row of gradeRows) {
    gradeMap.set(`${row.classOfferingId}:${row.termId}`, decimalToNumber(row.score));
  }

  const subjects = classOfferings.map((offering) => {
    const quarters = terms.map((term) => {
      const score = gradeMap.get(`${offering.id}:${term.id}`) ?? null;
      return buildVisibleQuarter(term, score, includeUnreleased);
    });
    const finalGrade = calculateFinalGrade(quarters.map((quarter) => quarter.score));
    const descriptor = finalGrade === null ? null : getGradeDescriptor(finalGrade);
    const passing = finalGrade === null ? null : isPassing(finalGrade);

    return {
      subjectCode: offering.subject.code,
      subjectName: offering.subject.name,
      teacherName: `${offering.teacher.firstName} ${offering.teacher.middleName ? `${offering.teacher.middleName} ` : ""}${offering.teacher.lastName}`.trim(),
      quarters,
      finalGrade,
      descriptor,
      passing,
    };
  });

  const generalAverage = calculateGeneralAverage(subjects.map((subject) => subject.finalGrade));
  const summary = buildSummary(subjects);
  const today = parseDateString(todayInManila());

  return {
    student: {
      id: student.id,
      studentNo: student.studentNo,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      sex: student.sex,
      birthDate: student.birthDate ? formatDateString(student.birthDate) : null,
    },
    schoolYear,
    section: { gradeLevel: section.gradeLevel, name: section.name },
    adviser: adviser ? { firstName: adviser.firstName, lastName: adviser.lastName } : null,
    enrollmentStatus: enrollment.status,
    terms: terms.map((term) => ({ id: term.id, name: term.name, order: term.termNumber, released: term.gradesLocked })),
    subjects,
    generalAverage,
    summary,
    attendance: {
      terms: terms.map((term) => {
        const counts = normalizeAttendanceCounts();
        for (const row of attendanceRows) {
          if (row.studentId !== student.id || row.classOffering.sectionId !== section.id) continue;
          if (row.date < term.startDate || row.date > term.endDate || row.date > today) continue;
          addAttendanceCounts(counts, row.status, 1);
        }
        return {
          termId: term.id,
          order: term.termNumber,
          released: term.gradesLocked,
          ...counts,
          rate: calculateAttendanceRate(counts),
        };
      }),
      overall: (() => {
        const counts = normalizeAttendanceCounts();
        for (const row of attendanceRows) {
          if (row.studentId !== student.id || row.classOffering.sectionId !== section.id) continue;
          if (row.date > today) continue;
          addAttendanceCounts(counts, row.status, 1);
        }
        return { ...counts, rate: calculateAttendanceRate(counts) };
      })(),
    },
    generatedAt: new Date().toISOString(),
    isDraft: includeUnreleased && terms.some((term) => !term.gradesLocked),
  };
}

function parseDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date;
}

export async function buildReportCard(
  studentId: string,
  schoolYearIdInput: string | undefined,
  options: { includeUnreleased?: boolean } = {},
  user: ReportCardUser,
): Promise<ReportCard> {
  return getStudentReportCard(studentId, schoolYearIdInput, {
    schoolYearId: schoolYearIdInput,
    includeUnreleased: options.includeUnreleased ?? false,
  }, user);
}

export async function getStudentReportCard(
  studentId: string,
  schoolYearIdInput: string | undefined,
  rawQuery: unknown,
  user: ReportCardUser,
): Promise<ReportCard> {
  const parsed = parseQuery(reportCardQuerySchema, rawQuery);
  const includeUnreleased = user.role === Role.ADMIN ? Boolean(parsed.includeUnreleased) : false;
  const schoolYearId = await resolveSchoolYearId(parsed.schoolYearId ?? schoolYearIdInput);
  await assertCanViewReportCard(user, studentId, schoolYearId);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      studentNo: true,
      firstName: true,
      middleName: true,
      lastName: true,
      sex: true,
      birthDate: true,
      enrollments: {
        where: { schoolYearId, status: { in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.DROPPED, EnrollmentStatus.COMPLETED] } },
        select: {
          status: true,
          section: {
            select: {
              id: true,
              gradeLevel: true,
              name: true,
              adviser: {
                select: { firstName: true, middleName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  if (!student) throw new AppError("Student not found", 404);
  const enrollment = student.enrollments[0];
  if (!enrollment || !enrollment.section) throw new AppError("No enrollment found", 404, "NO_ENROLLMENT");

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, name: true },
  });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const [terms, classOfferings, gradeRows, attendanceRows] = await Promise.all([
    prisma.term.findMany({
      where: { schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, name: true, termNumber: true, gradesLocked: true, startDate: true, endDate: true },
    }),
    prisma.classOffering.findMany({
      where: { sectionId: enrollment.section.id, schoolYearId },
      orderBy: [{ subject: { name: "asc" } }, { subject: { code: "asc" } }],
      select: {
        id: true,
        subject: { select: { code: true, name: true } },
        teacher: { select: { firstName: true, middleName: true, lastName: true } },
      },
    }),
    prisma.grade.findMany({
      where: {
        studentId,
        classOffering: { sectionId: enrollment.section.id, schoolYearId },
        termId: { in: (await prisma.term.findMany({ where: { schoolYearId }, select: { id: true } })).map((term) => term.id) },
      },
      select: { classOfferingId: true, termId: true, score: true },
    }),
    prisma.attendance.findMany({
      where: {
        studentId,
        classOffering: { sectionId: enrollment.section.id, schoolYearId },
        date: { lte: new Date() },
      },
      select: {
        studentId: true,
        classOfferingId: true,
        date: true,
        status: true,
        classOffering: { select: { sectionId: true } },
      },
    }),
  ]);

  const result = assembleReportCardFromData({
    student: {
      id: student.id,
      studentNo: student.studentNo,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      sex: student.sex,
      birthDate: student.birthDate,
    },
    enrollment: { status: enrollment.status },
    schoolYear: { id: schoolYear.id, name: schoolYear.name },
    section: { id: enrollment.section.id, gradeLevel: enrollment.section.gradeLevel, name: enrollment.section.name },
    adviser: enrollment.section.adviser,
    terms,
    classOfferings,
    gradeRows,
    attendanceRows,
    includeUnreleased,
  });

  return result;
}

export async function getSectionReportCards(sectionId: string, rawQuery: unknown, user: ReportCardUser): Promise<ReportCard[]> {
  const parsed = parseQuery(sectionReportCardsQuerySchema, rawQuery);
  const includeUnreleased = user.role === Role.ADMIN ? Boolean(parsed.includeUnreleased) : false;
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, schoolYearId: true, gradeLevel: true, name: true, adviserId: true },
  });
  if (!section) throw new AppError("Section not found", 404);

  if (user.role === Role.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!teacher || teacher.id !== section.adviserId) throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const enrollmentRows = await prisma.enrollment.findMany({
    where: { sectionId, status: EnrollmentStatus.ENROLLED },
    select: {
      studentId: true,
      student: {
        select: {
          id: true,
          studentNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          sex: true,
          birthDate: true,
        },
      },
      status: true,
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  if (enrollmentRows.length > 80) {
    throw new AppError("This section has too many students to print in one report. Please print in batches.", 400, "SECTION_TOO_LARGE");
  }

  const studentIds = enrollmentRows.map((item) => item.studentId);
  const schoolYearId = section.schoolYearId;
  const [terms, classOfferings, gradeRows, attendanceRows] = await Promise.all([
    prisma.term.findMany({
      where: { schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, name: true, termNumber: true, gradesLocked: true, startDate: true, endDate: true },
    }),
    prisma.classOffering.findMany({
      where: { sectionId, schoolYearId },
      orderBy: [{ subject: { name: "asc" } }, { subject: { code: "asc" } }],
      select: {
        id: true,
        subject: { select: { code: true, name: true } },
        teacher: { select: { firstName: true, middleName: true, lastName: true } },
      },
    }),
    prisma.grade.findMany({
      where: {
        studentId: { in: studentIds },
        classOffering: { sectionId, schoolYearId },
      },
      select: { studentId: true, classOfferingId: true, termId: true, score: true },
    }),
    prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        classOffering: { sectionId, schoolYearId },
        date: { lte: new Date() },
      },
      select: {
        studentId: true,
        classOfferingId: true,
        date: true,
        status: true,
        classOffering: { select: { sectionId: true } },
      },
    }),
  ]);

  const schoolYear = await prisma.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true, name: true } });
  if (!schoolYear) throw new AppError("School year not found", 404);

  const advisor = await prisma.teacher.findUnique({ where: { id: section.adviserId ?? "" }, select: { firstName: true, middleName: true, lastName: true } }).catch(() => null);

  return enrollmentRows.map((enrollment) => {
    const relevantGrades = gradeRows.filter((row) => row.studentId === enrollment.studentId);
    const relevantAttendance = attendanceRows.filter((row) => row.studentId === enrollment.studentId);
    return assembleReportCardFromData({
      student: {
        id: enrollment.student.id,
        studentNo: enrollment.student.studentNo,
        firstName: enrollment.student.firstName,
        middleName: enrollment.student.middleName,
        lastName: enrollment.student.lastName,
        sex: enrollment.student.sex,
        birthDate: enrollment.student.birthDate,
      },
      enrollment: { status: enrollment.status },
      schoolYear: { id: schoolYear.id, name: schoolYear.name },
      section: { id: section.id, gradeLevel: section.gradeLevel, name: section.name },
      adviser: advisor,
      terms,
      classOfferings,
      gradeRows: relevantGrades,
      attendanceRows: relevantAttendance,
      includeUnreleased,
    });
  });
}

export async function getAvailableSchoolYearsForStudent(studentId: string): Promise<Array<{ id: string; name: string }>> {
  const rows = await prisma.enrollment.findMany({
    where: { studentId },
    orderBy: [{ schoolYear: { startDate: "desc" } }],
    select: {
      schoolYear: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => row.schoolYear);
}
