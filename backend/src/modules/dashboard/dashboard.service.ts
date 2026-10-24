/*
 * Dashboard aggregates use grouped counts for enrollment by section, attendance by date/status,
 * grades by offering/score, and student attendance by student/offering/status. No row-per-class
 * or row-per-student database loops are used.
 */
import { AttendanceStatus, EnrollmentStatus, Prisma, StudentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { formatDateString, parseDateString } from "../../utils/dates.js";
import { calculateAttendanceRate } from "../attendance/attendance.rules.js";
import { calculateFinalGrade, calculateGeneralAverage, PASSING_GRADE } from "../../utils/grading.js";
import { cacheFor, getCurrentContext, lastSchoolDays, type CurrentContext } from "./dashboard.helpers.js";

type Counts = { present: number; absent: number; late: number; excused: number };

function emptyCounts(): Counts {
  return { present: 0, absent: 0, late: 0, excused: 0 };
}

function addStatus(counts: Counts, status: AttendanceStatus, amount: number): void {
  counts[status.toLowerCase() as keyof Counts] += amount;
}

function countsFromGroups(groups: readonly { status: AttendanceStatus; _count: { _all: number } }[]): Counts {
  const counts = emptyCounts();
  for (const group of groups) addStatus(counts, group.status, group._count._all);
  return counts;
}

function currentTermRange(context: CurrentContext): { gte: Date; lte: Date } | null {
  if (!context.currentTerm) return null;
  const end = parseDateString(formatDateString(context.currentTerm.endDate));
  const today = parseDateString(context.today);
  return {
    gte: parseDateString(formatDateString(context.currentTerm.startDate)),
    lte: end < today ? end : today,
  };
}

function contextPayload(context: CurrentContext) {
  if (!context.schoolYear) return null;
  return {
    schoolYear: { id: context.schoolYear.id, name: context.schoolYear.name },
    currentTerm: context.currentTerm
      ? {
          id: context.currentTerm.id,
          name: context.currentTerm.name,
          order: context.currentTerm.termNumber,
          gradesLocked: context.currentTerm.gradesLocked,
        }
      : null,
    currentTermSource: context.currentTermSource,
    today: context.today,
  };
}

function dateIsSunday(date: string): boolean {
  return parseDateString(date).getUTCDay() === 0;
}

export type GradeBucket = "90-100" | "85-89" | "80-84" | "75-79" | "below75";

export function getGradeBucket(score: number): GradeBucket {
  if (score >= 90) return "90-100";
  if (score >= 85) return "85-89";
  if (score >= 80) return "80-84";
  if (score >= PASSING_GRADE) return "75-79";
  return "below75";
}

type GradeDistribution = Record<GradeBucket, number>;

function emptyGradeDistribution(): GradeDistribution {
  return { "90-100": 0, "85-89": 0, "80-84": 0, "75-79": 0, below75: 0 };
}

function addGradeDistribution(distribution: GradeDistribution, score: number, count = 1): void {
  distribution[getGradeBucket(score)] += count;
}

function dateWhere(dates: string[]): Prisma.DateTimeFilter {
  return { in: dates.map(parseDateString) };
}

async function getAdminAggregates(context: CurrentContext) {
  const schoolYearId = context.schoolYear?.id;
  const [
    studentAccountGroups,
    teacherAccountGroups,
    enrolledStudents,
    unassignedStudents,
    sections,
    offerings,
  ] = await Promise.all([
    prisma.student.groupBy({
      by: ["userId"],
      where: { status: StudentStatus.ACTIVE },
      _count: { _all: true },
    }),
    prisma.teacher.groupBy({
      by: ["userId"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    schoolYearId
      ? prisma.enrollment.count({ where: { schoolYearId, status: EnrollmentStatus.ENROLLED } })
      : Promise.resolve(0),
    schoolYearId
      ? prisma.student.count({
          where: {
            status: StudentStatus.ACTIVE,
            enrollments: { none: { schoolYearId, status: EnrollmentStatus.ENROLLED } },
          },
        })
      : Promise.resolve(0),
    schoolYearId
      ? prisma.section.findMany({
          where: { schoolYearId },
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            adviser: { select: { firstName: true, middleName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    schoolYearId
      ? prisma.classOffering.findMany({
          where: { schoolYearId },
          select: { id: true, sectionId: true },
        })
      : Promise.resolve([]),
  ]);
  const activeStudents = studentAccountGroups.reduce((total, group) => total + group._count._all, 0);
  const activeTeachers = teacherAccountGroups.reduce((total, group) => total + group._count._all, 0);
  const studentsWithoutLogin = studentAccountGroups.find((group) => group.userId === null)?._count._all ?? 0;
  const teachersWithoutLogin = teacherAccountGroups.find((group) => group.userId === null)?._count._all ?? 0;
  const sectionsCount = sections.length;
  const offeringsCount = offerings.length;

  if (!schoolYearId || !context.schoolYear) {
    return {
      counts: {
        activeStudents, enrolledStudents, unassignedStudents, activeTeachers,
        sections: 0, classOfferings: 0,
        accountsWithoutLogin: { students: studentsWithoutLogin, teachers: teachersWithoutLogin },
      },
      enrollmentByGrade: Array.from({ length: 6 }, (_, index) => ({
        gradeLevel: index + 7,
        sections: 0,
        students: 0,
      })),
      sectionSizes: [],
      attendanceTrend: [],
      attendanceToday: { classesWithRecords: 0, classesExpected: 0, rate: null },
      gradeProgress: { gradedEntries: 0, expectedEntries: 0, percentComplete: 0, incompleteClasses: 0, locked: false },
      needsAttention: studentsWithoutLogin + teachersWithoutLogin > 0
        ? [{
            id: "accounts-without-login",
            severity: "info" as const,
            message: "Students or teachers have no login account",
            count: studentsWithoutLogin + teachersWithoutLogin,
            href: "/admin/students",
          }]
        : [],
    };
  }

  const sectionIds = sections.map(({ id }) => id);
  const offeringsBySection = new Map<string, number>();
  for (const offering of offerings) {
    offeringsBySection.set(offering.sectionId, (offeringsBySection.get(offering.sectionId) ?? 0) + 1);
  }
  const lastTenDays = lastSchoolDays(10, context.today, context.schoolYear);
  const lastThreeDays = lastSchoolDays(3, context.today, context.schoolYear);
  const today = parseDateString(context.today);
  const termId = context.currentTerm?.id;

  const [
    enrollmentGroups,
    trendGroups,
    todayAttendanceGroups,
    recentAttendanceOfferingGroups,
    gradeGroups,
  ] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["sectionId"],
      where: { schoolYearId, status: EnrollmentStatus.ENROLLED, sectionId: { in: sectionIds } },
      _count: { _all: true },
    }),
    lastTenDays.length
      ? prisma.attendance.groupBy({
          by: ["date", "status"],
          where: { classOffering: { schoolYearId }, date: dateWhere(lastTenDays) },
          _count: { _all: true },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
    prisma.attendance.groupBy({
      by: ["classOfferingId", "status"],
      where: { classOffering: { schoolYearId }, date: parseDateString(context.today) },
      _count: { _all: true },
    }),
    lastThreeDays.length
      ? prisma.attendance.groupBy({
          by: ["classOfferingId"],
          where: { classOffering: { schoolYearId }, date: dateWhere(lastThreeDays) },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    termId
      ? prisma.grade.groupBy({
          by: ["classOfferingId"],
          where: { termId, classOffering: { schoolYearId } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const enrolledBySection = new Map<string, number>();
  for (const group of enrollmentGroups) {
    if (group.sectionId) enrolledBySection.set(group.sectionId, group._count._all);
  }

  const enrollmentTotals = new Map<number, { sections: number; students: number }>();
  for (let grade = 7; grade <= 12; grade += 1) {
    enrollmentTotals.set(grade, { sections: 0, students: 0 });
  }
  for (const section of sections) {
    const totals = enrollmentTotals.get(section.gradeLevel);
    if (totals) {
      totals.sections += 1;
      totals.students += enrolledBySection.get(section.id) ?? 0;
    }
  }
  const enrollmentByGrade = [...enrollmentTotals].map(([gradeLevel, totals]) => ({
    gradeLevel,
    ...totals,
  }));
  const sectionSizes = sections.map((section) => ({
    sectionId: section.id,
    label: `Grade ${section.gradeLevel} - ${section.name}`,
    gradeLevel: section.gradeLevel,
    students: enrolledBySection.get(section.id) ?? 0,
    adviserName: section.adviser
      ? `${section.adviser.firstName}${section.adviser.middleName ? ` ${section.adviser.middleName}` : ""} ${section.adviser.lastName}`
      : null,
  }));

  const attendanceByDate = new Map<string, Counts>();
  for (const group of trendGroups) {
    const key = formatDateString(group.date);
    const counts = attendanceByDate.get(key) ?? emptyCounts();
    addStatus(counts, group.status, group._count._all);
    attendanceByDate.set(key, counts);
  }
  const attendanceTrend = lastTenDays.flatMap((date) => {
    const counts = attendanceByDate.get(date);
    return counts
      ? [{ date, ...counts, rate: calculateAttendanceRate(counts) }]
      : [];
  });
  const todayCounts = countsFromGroups(todayAttendanceGroups);
  const classesWithRecords = new Set(todayAttendanceGroups.map((group) => group.classOfferingId)).size;

  const gradedByOffering = new Map(gradeGroups.map((group) => [group.classOfferingId, group._count._all]));
  const expectedEntries = termId
    ? offerings.reduce((total, offering) => total + (enrolledBySection.get(offering.sectionId) ?? 0), 0)
    : 0;
  const gradedEntries = gradeGroups.reduce((total, group) => total + group._count._all, 0);
  const incompleteClasses = termId
    ? offerings.reduce((count, offering) => (
        count + ((enrolledBySection.get(offering.sectionId) ?? 0) > (gradedByOffering.get(offering.id) ?? 0) ? 1 : 0)
      ), 0)
    : 0;
  const schoolEnd = parseDateString(formatDateString(context.currentTerm?.endDate ?? context.schoolYear.endDate));
  const daysUntilTermEnd = Math.floor((schoolEnd.getTime() - today.getTime()) / 86_400_000);
  const sectionsWithoutOfferings = sections.filter((section) => !offeringsBySection.has(section.id)).length;
  const offeringsWithNoStudents = offerings.filter((offering) => !(enrolledBySection.get(offering.sectionId) ?? 0)).length;
  const offeringsWithRecentAttendance = new Set(recentAttendanceOfferingGroups.map((group) => group.classOfferingId));
  const classesWithoutRecentAttendance = offerings.filter((offering) => !offeringsWithRecentAttendance.has(offering.id)).length;
  const needsAttention = [
    { id: "unassigned-students", severity: "warning" as const, message: "Active students have no enrollment this school year", count: unassignedStudents, href: "/admin/enrollment" },
    { id: "sections-without-adviser", severity: "warning" as const, message: "Sections have no adviser", count: sections.filter((section) => !section.adviser).length, href: "/admin/sections" },
    { id: "sections-without-offerings", severity: "warning" as const, message: "Sections have no class offerings", count: sectionsWithoutOfferings, href: "/admin/sections" },
    { id: "empty-class-offerings", severity: "info" as const, message: "Class offerings have no enrolled students", count: offeringsWithNoStudents, href: "/admin/sections" },
    { id: "attendance-not-recorded", severity: "warning" as const, message: "Classes have no attendance recorded in the last three school days", count: classesWithoutRecentAttendance, href: "/admin/sections" },
    { id: "term-near-end", severity: "warning" as const, message: "The current term ends within seven days or has passed and is not locked", count: termId && !context.currentTerm?.gradesLocked && daysUntilTermEnd <= 7 ? 1 : 0, href: "/admin/school-years" },
    { id: "accounts-without-login", severity: "info" as const, message: "Students or teachers have no login account", count: studentsWithoutLogin + teachersWithoutLogin, href: "/admin/students" },
  ].filter((item) => item.count > 0);

  return {
    counts: {
      activeStudents, enrolledStudents, unassignedStudents, activeTeachers,
      sections: sectionsCount, classOfferings: offeringsCount,
      accountsWithoutLogin: { students: studentsWithoutLogin, teachers: teachersWithoutLogin },
    },
    enrollmentByGrade,
    sectionSizes,
    attendanceTrend,
    attendanceToday: {
      classesWithRecords,
      classesExpected: offeringsCount,
      rate: calculateAttendanceRate(todayCounts),
    },
    gradeProgress: {
      gradedEntries,
      expectedEntries,
      percentComplete: expectedEntries ? Math.min(100, Math.round((gradedEntries / expectedEntries) * 1000) / 10) : 0,
      incompleteClasses,
      locked: context.currentTerm?.gradesLocked ?? false,
    },
    needsAttention,
  };
}

export async function getAdminDashboard() {
  const context = await getCurrentContext();
  const aggregates = await cacheFor(
    `dashboard:admin:${context.schoolYear?.id ?? "no-current-year"}:${context.currentTerm?.id ?? "no-current-term"}`,
    60,
    () => getAdminAggregates(context),
  );
  const recentActivity = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      entity: true,
      createdAt: true,
      user: { select: { email: true, role: true } },
    },
  });
  return {
    context: contextPayload(context),
    ...aggregates,
    recentActivity: recentActivity.map(({ user, ...activity }) => ({
      ...activity,
      actor: user,
    })),
  };
}

export async function getTeacherDashboard(userId: string) {
  const context = await getCurrentContext();
  const teacherId = await getTeacherIdForUser(userId);
  if (!context.schoolYear) {
    return {
      context: null,
      counts: { classes: 0, studentsTotal: 0, advisorySection: null },
      classes: [],
      attendancePending: { count: 0, classOfferingIds: [] },
      atRisk: [],
      gradeDistribution: emptyGradeDistribution(),
    };
  }

  const schoolYearId = context.schoolYear.id;
  const [offerings, advisedSection] = await Promise.all([
    prisma.classOffering.findMany({
      where: { schoolYearId, teacherId },
      orderBy: [{ section: { gradeLevel: "asc" } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
      select: {
        id: true,
        subject: { select: { name: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
      },
    }),
    prisma.section.findFirst({
      where: { schoolYearId, adviserId: teacherId },
      select: { id: true, name: true, gradeLevel: true },
    }),
  ]);
  const offeringIds = offerings.map(({ id }) => id);
  const sectionIds = [...new Set(offerings.map(({ section }) => section.id))];
  const termRange = currentTermRange(context);
  const today = parseDateString(context.today);
  const isSunday = dateIsSunday(context.today);
  const [
    enrollmentGroups,
    attendanceTodayGroups,
    termAttendanceGroups,
    termGradeGroups,
    studentAttendanceGroups,
  ] = await Promise.all([
    sectionIds.length
      ? prisma.enrollment.groupBy({
          by: ["sectionId"],
          where: { schoolYearId, status: EnrollmentStatus.ENROLLED, sectionId: { in: sectionIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length
      ? prisma.attendance.groupBy({
          by: ["classOfferingId", "status"],
          where: { classOfferingId: { in: offeringIds }, date: today },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length && termRange
      ? prisma.attendance.groupBy({
          by: ["classOfferingId", "status"],
          where: { classOfferingId: { in: offeringIds }, date: termRange },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length && context.currentTerm
      ? prisma.grade.groupBy({
          by: ["classOfferingId", "score"],
          where: { classOfferingId: { in: offeringIds }, termId: context.currentTerm.id },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length && termRange
      ? prisma.attendance.groupBy({
          by: ["studentId", "classOfferingId", "status"],
          where: { classOfferingId: { in: offeringIds }, date: termRange },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const enrolledBySection = new Map(enrollmentGroups.flatMap((group) => (
    group.sectionId ? [[group.sectionId, group._count._all] as const] : []
  )));
  const todayByOffering = new Map<string, Counts>();
  for (const group of attendanceTodayGroups) {
    const counts = todayByOffering.get(group.classOfferingId) ?? emptyCounts();
    addStatus(counts, group.status, group._count._all);
    todayByOffering.set(group.classOfferingId, counts);
  }
  const termByOffering = new Map<string, Counts>();
  for (const group of termAttendanceGroups) {
    const counts = termByOffering.get(group.classOfferingId) ?? emptyCounts();
    addStatus(counts, group.status, group._count._all);
    termByOffering.set(group.classOfferingId, counts);
  }
  const gradedByOffering = new Map<string, number>();
  const gradeDistribution = emptyGradeDistribution();
  for (const group of termGradeGroups) {
    const count = group._count._all;
    gradedByOffering.set(group.classOfferingId, (gradedByOffering.get(group.classOfferingId) ?? 0) + count);
    addGradeDistribution(gradeDistribution, Number(group.score), count);
  }
  const classes = offerings.map((offering) => {
    const studentCount = enrolledBySection.get(offering.section.id) ?? 0;
    const attendanceCounts = todayByOffering.get(offering.id) ?? emptyCounts();
    const termAttendanceCounts = termByOffering.get(offering.id) ?? emptyCounts();
    return {
      classOfferingId: offering.id,
      subjectName: offering.subject.name,
      sectionLabel: `Grade ${offering.section.gradeLevel} - ${offering.section.name}`,
      students: studentCount,
      attendanceToday: {
        recorded: (todayByOffering.get(offering.id)?.present ?? 0)
          + (todayByOffering.get(offering.id)?.absent ?? 0)
          + (todayByOffering.get(offering.id)?.late ?? 0)
          + (todayByOffering.get(offering.id)?.excused ?? 0) > 0,
        present: attendanceCounts.present,
        absent: attendanceCounts.absent,
        late: attendanceCounts.late,
        excused: attendanceCounts.excused,
      },
      attendanceRate: calculateAttendanceRate(termAttendanceCounts),
      gradesCurrentTerm: {
        graded: gradedByOffering.get(offering.id) ?? 0,
        expected: context.currentTerm ? studentCount : 0,
        locked: context.currentTerm?.gradesLocked ?? false,
      },
    };
  });

  const attendancePendingIds = isSunday
    ? []
    : classes.filter((classItem) => !classItem.attendanceToday.recorded).map((classItem) => classItem.classOfferingId);
  const atRiskGroups = new Map<string, { studentId: string; classOfferingId: string; counts: Counts }>();
  for (const group of studentAttendanceGroups) {
    const key = `${group.studentId}:${group.classOfferingId}`;
    const entry = atRiskGroups.get(key) ?? {
      studentId: group.studentId,
      classOfferingId: group.classOfferingId,
      counts: emptyCounts(),
    };
    addStatus(entry.counts, group.status, group._count._all);
    atRiskGroups.set(key, entry);
  }
  const classById = new Map(offerings.map((offering) => [offering.id, offering]));
  const atRiskCandidates = [...atRiskGroups.values()].flatMap((entry) => {
    const countable = entry.counts.present + entry.counts.absent + entry.counts.late;
    const rate = calculateAttendanceRate(entry.counts);
    const offering = classById.get(entry.classOfferingId);
    return countable >= 5 && rate !== null && rate < 90 && offering
      ? [{ ...entry, rate, subjectName: offering.subject.name }]
      : [];
  }).sort((a, b) => a.rate - b.rate).slice(0, 10);
  // This is a follow-up flag, not a ranking; there is no leaderboard of top students.
  const atRiskStudents = await prisma.student.findMany({
    where: { id: { in: [...new Set(atRiskCandidates.map(({ studentId }) => studentId))] } },
    select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
  });
  const studentById = new Map(atRiskStudents.map((student) => [student.id, student]));
  const atRisk = atRiskCandidates.flatMap((candidate) => {
    const student = studentById.get(candidate.studentId);
    if (!student) return [];
    return [{
      studentId: student.id,
      studentNo: student.studentNo,
      name: `${student.firstName}${student.middleName ? ` ${student.middleName}` : ""} ${student.lastName}`,
      classOfferingId: candidate.classOfferingId,
      subjectName: candidate.subjectName,
      rate: candidate.rate,
    }];
  });
  const advisorySection = advisedSection
    ? {
        id: advisedSection.id,
        label: `Grade ${advisedSection.gradeLevel} - ${advisedSection.name}`,
        students: enrolledBySection.get(advisedSection.id) ?? await prisma.enrollment.count({
          where: { schoolYearId, sectionId: advisedSection.id, status: EnrollmentStatus.ENROLLED },
        }),
      }
    : null;

  return {
    context: contextPayload(context),
    counts: {
      classes: offerings.length,
      studentsTotal: classes.reduce((total, classItem) => total + classItem.students, 0),
      advisorySection,
    },
    classes,
    attendancePending: { count: attendancePendingIds.length, classOfferingIds: attendancePendingIds },
    atRisk,
    gradeDistribution,
  };
}

function emptyStudentDashboard(context: CurrentContext) {
  return {
    context: contextPayload(context),
    enrollment: null,
    attendance: {
      overallRate: null,
      currentTermRate: null,
      counts: emptyCounts(),
      recentAbsences: [],
    },
    grades: {
      releasedTerms: 0,
      generalAverage: null,
      subjectsPassed: 0,
      subjectsBelowPassing: 0,
      latestReleasedTerm: null,
    },
    reportCardAvailable: false,
  };
}

export async function getStudentDashboard(userId: string) {
  const context = await getCurrentContext();
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  if (!context.schoolYear) return emptyStudentDashboard(context);

  const schoolYearId = context.schoolYear.id;
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, schoolYearId },
    select: {
      status: true,
      section: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          adviser: { select: { firstName: true, middleName: true, lastName: true } },
        },
      },
    },
  });
  if (!enrollment?.section) return emptyStudentDashboard(context);

  const offerings = await prisma.classOffering.findMany({
    where: { schoolYearId, sectionId: enrollment.section.id },
    select: { id: true, subject: { select: { id: true, name: true } } },
  });
  const offeringIds = offerings.map(({ id }) => id);
  const termRange = currentTermRange(context);
  const [
    allAttendanceGroups,
    termAttendanceGroups,
    recentAbsences,
    lockedGrades,
  ] = await Promise.all([
    offeringIds.length
      ? prisma.attendance.groupBy({
          by: ["status"],
          where: {
            studentId: student.id,
            classOfferingId: { in: offeringIds },
            date: { gte: parseDateString(formatDateString(context.schoolYear.startDate)), lte: parseDateString(context.today) },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length && termRange
      ? prisma.attendance.groupBy({
          by: ["status"],
          where: { studentId: student.id, classOfferingId: { in: offeringIds }, date: termRange },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    offeringIds.length
      ? prisma.attendance.findMany({
          where: {
            studentId: student.id,
            classOfferingId: { in: offeringIds },
            status: { in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE] },
            date: { gte: parseDateString(formatDateString(context.schoolYear.startDate)), lte: parseDateString(context.today) },
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 5,
          select: {
            date: true,
            status: true,
            classOffering: { select: { subject: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    offerings.length
      ? prisma.grade.findMany({
          where: {
            studentId: student.id,
            classOfferingId: { in: offeringIds },
            term: { schoolYearId, gradesLocked: true },
          },
          select: {
            score: true,
            termId: true,
            classOffering: { select: { subjectId: true } },
            term: { select: { name: true, termNumber: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const attendanceCounts = countsFromGroups(allAttendanceGroups);
  const currentTermCounts = countsFromGroups(termAttendanceGroups);

  const releasedTerms = context.schoolYear.terms.filter((term) => term.gradesLocked);
  const scoresBySubject = new Map<string, Map<string, number>>();
  const scoreByTerm = new Map<string, number[]>();
  const termById = new Map(context.schoolYear.terms.map((term) => [term.id, term]));
  for (const grade of lockedGrades) {
    const score = Number(grade.score);
    const subjectScores = scoresBySubject.get(grade.classOffering.subjectId) ?? new Map<string, number>();
    subjectScores.set(grade.termId, score);
    scoresBySubject.set(grade.classOffering.subjectId, subjectScores);
    const termScores = scoreByTerm.get(grade.termId) ?? [];
    termScores.push(score);
    scoreByTerm.set(grade.termId, termScores);
  }
  const finalGrades = [...scoresBySubject.values()].map((subjectScores) => (
    calculateFinalGrade(context.schoolYear!.terms.map((term) => subjectScores.get(term.id) ?? null))
  ));
  const latestReleased = [...releasedTerms].sort((a, b) => b.termNumber - a.termNumber)[0];
  const latestScores = latestReleased ? scoreByTerm.get(latestReleased.id) ?? [] : [];

  return {
    context: contextPayload(context),
    enrollment: {
      sectionLabel: `Grade ${enrollment.section.gradeLevel} - ${enrollment.section.name}`,
      gradeLevel: enrollment.section.gradeLevel,
      adviserName: enrollment.section.adviser
        ? `${enrollment.section.adviser.firstName}${enrollment.section.adviser.middleName ? ` ${enrollment.section.adviser.middleName}` : ""} ${enrollment.section.adviser.lastName}`
        : null,
    },
    attendance: {
      overallRate: calculateAttendanceRate(attendanceCounts),
      currentTermRate: calculateAttendanceRate(currentTermCounts),
      counts: attendanceCounts,
      recentAbsences: recentAbsences.map((record) => ({
        date: formatDateString(record.date),
        subjectName: record.classOffering.subject.name,
        status: record.status,
      })),
    },
    grades: {
      releasedTerms: releasedTerms.length,
      generalAverage: calculateGeneralAverage(finalGrades),
      subjectsPassed: finalGrades.filter((grade): grade is number => grade !== null && grade >= PASSING_GRADE).length,
      subjectsBelowPassing: finalGrades.filter((grade): grade is number => grade !== null && grade < PASSING_GRADE).length,
      latestReleasedTerm: latestReleased
        ? { name: latestReleased.name, average: calculateGeneralAverage(latestScores) }
        : null,
    },
    reportCardAvailable: true,
  };
}
