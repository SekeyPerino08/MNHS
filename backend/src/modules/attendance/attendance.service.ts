import { AttendanceStatus, EnrollmentStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { assertCanAccessClassOffering } from "../../services/access.service.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { formatDateString, parseDateString, todayInManila } from "../../utils/dates.js";
import { calculateAttendanceRate, canEditAttendance } from "./attendance.rules.js";
import {
  attendanceDateQuerySchema,
  attendanceMonthQuerySchema,
  attendanceSummaryQuerySchema,
  saveAttendanceSchema,
  studentAttendanceQuerySchema,
} from "./attendance.schema.js";

type CountSummary = {
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type StatusGroup = {
  status: AttendanceStatus;
  _count: { _all: number };
};

const emptyCounts = (): CountSummary => ({ present: 0, absent: 0, late: 0, excused: 0 });

function addStatusCount(counts: CountSummary, status: AttendanceStatus, amount: number): void {
  switch (status) {
    case AttendanceStatus.PRESENT: counts.present += amount; break;
    case AttendanceStatus.ABSENT: counts.absent += amount; break;
    case AttendanceStatus.LATE: counts.late += amount; break;
    case AttendanceStatus.EXCUSED: counts.excused += amount; break;
  }
}

function countGroups(groups: StatusGroup[]): CountSummary {
  const counts = emptyCounts();
  for (const group of groups) addStatusCount(counts, group.status, group._count._all);
  return counts;
}

function parseQuery<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  }
  return parsed.data;
}

function dateRange(from: string, to: string): { gte: Date; lte: Date } {
  if (from > to) throw new AppError("from must be on or before to", 400, "INVALID_DATE_RANGE");
  return { gte: parseDateString(from), lte: parseDateString(to) };
}

async function getOfferingForAttendance(classOfferingId: string) {
  const offering = await prisma.classOffering.findUnique({
    where: { id: classOfferingId },
    select: {
      id: true,
      sectionId: true,
      schoolYearId: true,
      schoolYear: { select: { startDate: true, endDate: true } },
    },
  });
  if (!offering) throw new AppError("Class offering not found", 404);
  return offering;
}

function isEditable(user: { role: Role }, date: string, schoolYear: { startDate: Date; endDate: Date }): boolean {
  try {
    return canEditAttendance(user, date, schoolYear);
  } catch (error) {
    if (error instanceof AppError && ["FUTURE_DATE", "OUTSIDE_SCHOOL_YEAR", "EDIT_WINDOW_CLOSED"].includes(error.code ?? "")) {
      return false;
    }
    throw error;
  }
}

function statusSummary(counts: CountSummary) {
  return { ...counts, total: counts.present + counts.absent + counts.late + counts.excused };
}

function mapPrismaAttendanceError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("Attendance record already exists for this student, class, and date", 409, "ATTENDANCE_CONFLICT");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new AppError("Attendance record or related resource not found", 404);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new AppError("The referenced student or class offering does not exist", 400, "INVALID_REFERENCE");
  }
  throw error;
}

export async function getClassAttendance(
  classOfferingId: string,
  user: { id: string; role: Role },
  query: unknown,
) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const { date: requestedDate } = parseQuery(attendanceDateQuerySchema, query);
  const date = requestedDate ?? todayInManila();
  const offering = await getOfferingForAttendance(classOfferingId);
  const enrollments = await prisma.enrollment.findMany({
    where: {
      sectionId: offering.sectionId,
      status: EnrollmentStatus.ENROLLED,
    },
    select: {
      student: {
        select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true, sex: true },
      },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
  const saved = await prisma.attendance.findMany({
    where: {
      classOfferingId,
      date: parseDateString(date),
    },
    select: { studentId: true, status: true, remarks: true },
  });
  const savedByStudent = new Map(saved.map((record) => [record.studentId, record]));
  return {
    date,
    recorded: saved.length > 0,
    editable: isEditable(user, date, offering.schoolYear),
    students: enrollments.map(({ student }) => {
      const attendance = savedByStudent.get(student.id);
      return { ...student, attendance: attendance ? { status: attendance.status, remarks: attendance.remarks } : null };
    }),
  };
}

export async function saveClassAttendance(
  classOfferingId: string,
  user: { id: string; role: Role },
  rawBody: unknown,
  request: Request,
) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const parsed = saveAttendanceSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  }
  const { date, records } = parsed.data;
  const offering = await getOfferingForAttendance(classOfferingId);
  canEditAttendance(user, date, offering.schoolYear);

  const attendanceDate = parseDateString(date);
  try {
    await prisma.$transaction(async (transaction) => {
      const roster = await transaction.enrollment.findMany({
        where: { sectionId: offering.sectionId, status: EnrollmentStatus.ENROLLED },
        select: { studentId: true },
      });
      const rosterIds = new Set(roster.map(({ studentId }) => studentId));
      const offendingIds = records.map(({ studentId }) => studentId).filter((studentId) => !rosterIds.has(studentId));
      if (offendingIds.length) {
        throw new AppError("One or more students are not on this class roster", 400, "STUDENT_NOT_IN_CLASS", {
          studentIds: offendingIds,
        });
      }
      await Promise.all(records.map((record) => transaction.attendance.upsert({
        where: {
          studentId_classOfferingId_date: {
            studentId: record.studentId,
            classOfferingId,
            date: attendanceDate,
          },
        },
        create: {
          studentId: record.studentId,
          classOfferingId,
          date: attendanceDate,
          status: record.status,
          remarks: record.remarks,
          recordedById: user.id,
        },
        update: {
          status: record.status,
          remarks: record.remarks,
          recordedById: user.id,
        },
      })));
    });
  } catch (error) {
    mapPrismaAttendanceError(error);
  }

  const summary = countGroups(records.map(({ status }) => ({ status, _count: { _all: 1 } })));
  await logAudit({
    userId: user.id,
    action: "ATTENDANCE_SAVE",
    entity: "ClassOffering",
    entityId: classOfferingId,
    ipAddress: request.ip,
    details: { date, ...summary },
  });
  return { date, saved: records.length, summary };
}

export async function getClassAttendanceSummary(
  classOfferingId: string,
  user: { id: string; role: Role },
  query: unknown,
) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const input = parseQuery(attendanceSummaryQuerySchema, query);
  const offering = await getOfferingForAttendance(classOfferingId);
  const from = input.from ?? formatDateString(offering.schoolYear.startDate);
  const to = input.to ?? todayInManila();
  const range = dateRange(from, to);
  const roster = await prisma.enrollment.findMany({
    where: { sectionId: offering.sectionId, status: EnrollmentStatus.ENROLLED },
    select: { student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true, sex: true } } },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
  const [groups, dates] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { classOfferingId, date: range, studentId: { in: roster.map(({ student }) => student.id) } },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { classOfferingId, date: range },
      distinct: ["date"],
      select: { date: true },
    }),
  ]);
  const byStudent = new Map<string, CountSummary>();
  for (const group of groups) {
    const counts = byStudent.get(group.studentId) ?? emptyCounts();
    addStatusCount(counts, group.status, group._count._all);
    byStudent.set(group.studentId, counts);
  }
  const totalCounts = countGroups(groups);
  const students = roster.map(({ student }) => {
    const counts = byStudent.get(student.id) ?? emptyCounts();
    return { ...student, ...statusSummary(counts), rate: calculateAttendanceRate(counts) };
  });
  return {
    from,
    to,
    students,
    overall: {
      ...statusSummary(totalCounts),
      rate: calculateAttendanceRate(totalCounts),
      recordedDates: dates.length,
    },
  };
}

export async function getClassAttendanceDates(
  classOfferingId: string,
  user: { id: string; role: Role },
  query: unknown,
) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const { month } = parseQuery(attendanceMonthQuerySchema, query);
  const [year, monthNumber] = month.split("-").map(Number);
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  const groups = await prisma.attendance.groupBy({
    by: ["date", "status"],
    where: { classOfferingId, date: { gte: parseDateString(from), lte: parseDateString(to) } },
    _count: { _all: true },
    orderBy: { date: "asc" },
  });
  const byDate = new Map<string, CountSummary>();
  for (const group of groups) {
    const key = formatDateString(group.date);
    const counts = byDate.get(key) ?? emptyCounts();
    addStatusCount(counts, group.status, group._count._all);
    byDate.set(key, counts);
  }
  return {
    month,
    dates: [...byDate.entries()].map(([date, counts]) => ({ date, ...statusSummary(counts) })),
  };
}

async function getCurrentSchoolYear() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!schoolYear) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return schoolYear;
}

function resolveStudentRange(
  schoolYear: { startDate: Date; endDate: Date },
  input: { from?: string; to?: string },
) {
  const from = input.from ?? formatDateString(schoolYear.startDate);
  const to = input.to ?? todayInManila();
  return { from, to, range: dateRange(from, to) };
}

async function buildStudentAttendance(
  studentId: string,
  input: { from?: string; to?: string; classOfferingId?: string; page: number; pageSize: number },
) {
  const schoolYear = await getCurrentSchoolYear();
  const { from, to, range } = resolveStudentRange(schoolYear, input);
  const offeringFilter: Prisma.AttendanceWhereInput = input.classOfferingId
    ? { classOfferingId: input.classOfferingId }
    : {};
  const where: Prisma.AttendanceWhereInput = { studentId, date: range, ...offeringFilter };
  const { skip, take } = parsePagination(input);
  const [rows, total, groups] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip,
      take,
      select: {
        date: true,
        status: true,
        remarks: true,
        classOffering: { select: { id: true, subject: { select: { id: true, code: true, name: true } } } },
      },
    }),
    prisma.attendance.count({ where }),
    prisma.attendance.groupBy({
      by: ["classOfferingId", "status"],
      where,
      _count: { _all: true },
    }),
  ]);
  const offeringIds = [...new Set(groups.map(({ classOfferingId }) => classOfferingId))];
  const offerings = offeringIds.length
    ? await prisma.classOffering.findMany({
      where: { id: { in: offeringIds } },
      select: { id: true, subject: { select: { id: true, code: true, name: true } } },
    })
    : [];
  const subjectByOffering = new Map(offerings.map(({ id, subject }) => [id, subject]));
  const bySubject = new Map<string, { subject: { id: string; code: string; name: string }; counts: CountSummary }>();
  for (const group of groups) {
    const subject = subjectByOffering.get(group.classOfferingId);
    if (!subject) continue;
    const entry = bySubject.get(subject.id) ?? { subject, counts: emptyCounts() };
    addStatusCount(entry.counts, group.status, group._count._all);
    bySubject.set(subject.id, entry);
  }
  const overallCounts = countGroups(groups);
  return {
    records: rows.map((row) => ({
      date: formatDateString(row.date),
      subject: row.classOffering.subject,
      status: row.status,
      remarks: row.remarks,
    })),
    pagination: buildPaginationMeta(input.page, input.pageSize, total),
    summary: {
      bySubject: [...bySubject.values()].map(({ subject, counts }) => ({
        subject,
        ...statusSummary(counts),
        rate: calculateAttendanceRate(counts),
      })),
      overall: {
        ...statusSummary(overallCounts),
        rate: calculateAttendanceRate(overallCounts),
      },
    },
    from,
    to,
  };
}

export async function getMyAttendance(userId: string, query: unknown) {
  const input = parseQuery(studentAttendanceQuerySchema, query);
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  if (input.classOfferingId) {
    const ownOffering = await prisma.classOffering.findFirst({
      where: {
        id: input.classOfferingId,
        section: { enrollments: { some: { studentId: student.id, status: EnrollmentStatus.ENROLLED } } },
      },
      select: { id: true },
    });
    if (!ownOffering) throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  return buildStudentAttendance(student.id, input);
}

export async function getStudentAttendance(studentId: string, query: unknown) {
  const input = parseQuery(studentAttendanceQuerySchema.omit({ classOfferingId: true }), query);
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new AppError("Student not found", 404);
  return buildStudentAttendance(student.id, input);
}
