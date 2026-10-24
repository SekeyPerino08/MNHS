import { EnrollmentStatus, Prisma, Role, StudentStatus } from "@prisma/client";
import { z, type ZodType } from "zod";
import { MAX_EXPORT_ROWS } from "../../config/limits.js";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { assertCanAccessClassOffering, getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { formatDateString, parseDateString, todayInManila } from "../../utils/dates.js";
import { writeCsv } from "../../utils/csv.js";
import { buildReportFilename } from "../../utils/filename.js";
import { redactSensitive } from "../../utils/redact.js";
import {
  buildAttendanceDaily,
  buildAttendanceSummary,
  type AttendanceRecord,
} from "./builders/class-attendance.builder.js";
import { buildAuditLog } from "./builders/audit-log.builder.js";
import { buildClassGrades } from "./builders/class-grades.builder.js";
import { buildClassRoster } from "./builders/class-roster.builder.js";
import { buildSectionClassList } from "./builders/section-class-list.builder.js";
import { buildSectionGrades } from "./builders/section-grades.builder.js";
import { buildStudentsMasterlist } from "./builders/students-masterlist.builder.js";
import { buildTeachersList } from "./builders/teachers-list.builder.js";
import type { BuiltReport } from "./builders/types.js";
import {
  auditLogSchema,
  classAttendanceSchema,
  classOfferingIdSchema,
  sectionGradesSchema,
  sectionIdSchema,
  studentsMasterlistSchema,
  teachersListSchema,
} from "./reports.schema.js";

export interface ReportUser {
  id: string;
  role: Role;
}

interface PreparedReport {
  filters: Record<string, unknown>;
  built: BuiltReport;
  scopeParts: Array<string | null | undefined>;
  draft?: boolean;
  includesUnreleased?: boolean;
  includesContactDetails?: boolean;
}

interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  roles: readonly Role[];
  filters: Array<{ name: string; type: string; required: boolean; options?: string[] }>;
  prepare(rawFilters: unknown, user: ReportUser): Promise<PreparedReport>;
}

function definition<TSchema extends ZodType<unknown>>(
  metadata: Omit<ReportDefinition, "prepare">,
  schema: TSchema,
  prepare: (filters: z.infer<TSchema>, user: ReportUser) => Promise<PreparedReport>,
): ReportDefinition {
  return {
    ...metadata,
    async prepare(rawFilters, user) {
      const parsed = schema.safeParse(rawFilters);
      if (!parsed.success) {
        throw new AppError("Invalid report filters", 400, "VALIDATION_ERROR", {
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      return prepare(parsed.data, user);
    },
  };
}

const all = [Role.ADMIN, Role.TEACHER] as const;
const admin = [Role.ADMIN] as const;

// Student and teacher rows use name order; audit logs stay chronological, with no score/rate sorting or ranking columns.
const reports: Record<string, ReportDefinition> = {
  "students-masterlist": definition(
    {
      key: "students-masterlist",
      title: "Students Masterlist",
      description: "Student records and enrollment for a school year.",
      roles: admin,
      filters: [
        { name: "schoolYearId", type: "schoolYear", required: false },
        { name: "gradeLevel", type: "number", required: false },
        { name: "sectionId", type: "section", required: false },
        { name: "status", type: "StudentStatus", required: false, options: Object.values(StudentStatus) },
        { name: "enrollment", type: "select", required: false, options: ["all", "enrolled", "unassigned"] },
        { name: "includeContact", type: "boolean", required: false },
      ],
    },
    studentsMasterlistSchema,
    async (filters) => {
      const schoolYear = await resolveSchoolYear(filters.schoolYearId);
      const currentEnrollment: Prisma.EnrollmentWhereInput = {
        schoolYearId: schoolYear.id,
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.gradeLevel !== undefined ? { section: { is: { gradeLevel: filters.gradeLevel } } } : {}),
      };
      const where: Prisma.StudentWhereInput = {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.enrollment === "enrolled"
          ? { enrollments: { some: { ...currentEnrollment, status: EnrollmentStatus.ENROLLED } } }
          : filters.enrollment === "unassigned"
            ? { enrollments: { none: { schoolYearId: schoolYear.id } } }
            : (filters.sectionId || filters.gradeLevel !== undefined)
              ? { enrollments: { some: currentEnrollment } }
              : {}),
        ...(filters.enrollment === "unassigned" && (filters.sectionId || filters.gradeLevel !== undefined)
          ? { id: { in: [] } }
          : {}),
      };
      const [students, section] = await Promise.all([prisma.student.findMany({
        where,
        take: MAX_EXPORT_ROWS + 1,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        select: {
          studentNo: true,
          firstName: true,
          middleName: true,
          lastName: true,
          sex: true,
          birthDate: true,
          status: true,
          userId: true,
          ...(filters.includeContact ? { guardianName: true, guardianContact: true, address: true } : {}),
          enrollments: {
            where: { schoolYearId: schoolYear.id },
            take: 1,
            select: {
              status: true,
              section: { select: { gradeLevel: true, name: true } },
            },
          },
        },
      }), filters.sectionId ? prisma.section.findFirst({
        where: { id: filters.sectionId, schoolYearId: schoolYear.id },
        select: { name: true, gradeLevel: true },
      }) : Promise.resolve(null)]);
      if (filters.sectionId && !section) throw new AppError("Section not found for this school year", 404, "NOT_FOUND");
      return {
        filters: { ...filters, schoolYearId: schoolYear.id },
        built: buildStudentsMasterlist(students, filters.includeContact ?? false),
        scopeParts: [schoolYear.name, section ? sectionLabel(section.gradeLevel, section.name) : undefined],
        includesContactDetails: filters.includeContact,
      };
    },
  ),
  "section-class-list": definition(
    {
      key: "section-class-list",
      title: "Section Class List",
      description: "Enrolled student list for an advisory section.",
      roles: all,
      filters: [{ name: "sectionId", type: "section", required: true }],
    },
    sectionIdSchema,
    async (filters, user) => {
      const section = await prisma.section.findUnique({
        where: { id: filters.sectionId },
        select: {
          id: true, name: true, gradeLevel: true, schoolYearId: true,
          schoolYear: { select: { name: true } }, adviserId: true,
        },
      });
      if (!section) throw new AppError("Section not found", 404, "NOT_FOUND");
      await assertCanAccessAdvisorySection(user, section.adviserId);
      const enrollments = await prisma.enrollment.findMany({
        where: { sectionId: section.id, schoolYearId: section.schoolYearId, status: EnrollmentStatus.ENROLLED },
        take: MAX_EXPORT_ROWS + 1,
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { student: { id: "asc" } }],
        select: { student: { select: studentRosterSelect } },
      });
      const students = enrollments.map(({ student }) => student);
      return {
        filters,
        built: buildSectionClassList(students),
        scopeParts: [section.schoolYear.name, sectionLabel(section.gradeLevel, section.name)],
      };
    },
  ),
  "class-roster": definition(
    {
      key: "class-roster",
      title: "Class Roster",
      description: "Enrolled students for an assigned class offering.",
      roles: all,
      filters: [{ name: "classOfferingId", type: "classOffering", required: true }],
    },
    classOfferingIdSchema,
    async (filters, user) => {
      await assertCanAccessClassOffering(user, filters.classOfferingId);
      const offering = await prisma.classOffering.findUnique({
        where: { id: filters.classOfferingId },
        select: {
          id: true,
          schoolYearId: true,
          schoolYear: { select: { name: true } },
          subject: { select: { code: true } },
          section: {
            select: {
              id: true, name: true, gradeLevel: true,
            },
          },
        },
      });
      if (!offering) throw new AppError("Class offering not found", 404, "NOT_FOUND");
      const enrollments = await prisma.enrollment.findMany({
        where: { sectionId: offering.section.id, schoolYearId: offering.schoolYearId, status: EnrollmentStatus.ENROLLED },
        take: MAX_EXPORT_ROWS + 1,
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { student: { id: "asc" } }],
        select: { student: { select: studentRosterSelect } },
      });
      return {
        filters,
        built: buildClassRoster(enrollments.map(({ student }) => student)),
        scopeParts: [offering.schoolYear.name, sectionLabel(offering.section.gradeLevel, offering.section.name), offering.subject.code],
      };
    },
  ),
  "class-attendance": definition(
    {
      key: "class-attendance",
      title: "Class Attendance",
      description: "Attendance totals or a daily attendance matrix for a class.",
      roles: all,
      filters: [
        { name: "classOfferingId", type: "classOffering", required: true },
        { name: "from", type: "date", required: false },
        { name: "to", type: "date", required: false },
        { name: "layout", type: "select", required: false, options: ["summary", "daily"] },
      ],
    },
    classAttendanceSchema,
    async (filters, user) => {
      await assertCanAccessClassOffering(user, filters.classOfferingId);
      const offering = await prisma.classOffering.findUnique({
        where: { id: filters.classOfferingId },
        select: {
          id: true,
          schoolYear: { select: { id: true, name: true, startDate: true, endDate: true } },
          subject: { select: { code: true } },
          section: {
            select: {
              id: true, name: true, gradeLevel: true,
            },
          },
        },
      });
      if (!offering) throw new AppError("Class offering not found", 404, "NOT_FOUND");
      const today = todayInManila();
      const schoolStart = formatDateString(offering.schoolYear.startDate);
      const schoolEnd = formatDateString(offering.schoolYear.endDate);
      const from = filters.from ?? schoolStart;
      const to = filters.to ?? (today < schoolEnd ? today : schoolEnd);
      validateSchoolYearDateRange(from, to, schoolStart, schoolEnd, today);
      const [records, enrollments] = await Promise.all([
        prisma.attendance.findMany({
          where: {
            classOfferingId: offering.id,
            date: { gte: parseDateString(from), lt: nextUtcDate(to) },
          },
          select: { studentId: true, date: true, status: true },
          orderBy: [{ date: "asc" }, { studentId: "asc" }],
        }),
        prisma.enrollment.findMany({
          where: { sectionId: offering.section.id, schoolYearId: offering.schoolYear.id, status: EnrollmentStatus.ENROLLED },
          take: MAX_EXPORT_ROWS + 1,
          orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { student: { id: "asc" } }],
          select: { student: { select: { ...studentRosterSelect, id: true } } },
        }),
      ]);
      const students = enrollments.map(({ student }) => student);
      const attendanceRecords: AttendanceRecord[] = records.map((record) => ({
        studentId: record.studentId,
        date: formatDateString(record.date),
        status: record.status,
      }));
      let built: BuiltReport;
      try {
        built = filters.layout === "daily"
          ? buildAttendanceDaily(students, attendanceRecords)
          : buildAttendanceSummary(students, attendanceRecords);
      } catch (error) {
        if (error instanceof RangeError) {
          throw new AppError(error.message, 400, "DAILY_RANGE_TOO_LARGE");
        }
        throw error;
      }
      return {
        filters: { ...filters, from, to },
        built,
        scopeParts: [offering.schoolYear.name, sectionLabel(offering.section.gradeLevel, offering.section.name), offering.subject.code],
      };
    },
  ),
  "class-grades": definition(
    {
      key: "class-grades",
      title: "Class Grades",
      description: "Quarter scores and final grades for an assigned class.",
      roles: all,
      filters: [{ name: "classOfferingId", type: "classOffering", required: true }],
    },
    classOfferingIdSchema,
    async (filters, user) => {
      await assertCanAccessClassOffering(user, filters.classOfferingId);
      const offering = await prisma.classOffering.findUnique({
        where: { id: filters.classOfferingId },
        select: {
          id: true, schoolYearId: true,
          schoolYear: { select: { name: true } },
          subject: { select: { code: true } },
          section: {
            select: {
              id: true, name: true, gradeLevel: true,
            },
          },
        },
      });
      if (!offering) throw new AppError("Class offering not found", 404, "NOT_FOUND");
      const [terms, enrollments] = await Promise.all([
        prisma.term.findMany({
          where: { schoolYearId: offering.schoolYearId },
          orderBy: { termNumber: "asc" },
          select: { id: true, termNumber: true },
        }),
        prisma.enrollment.findMany({
          where: { sectionId: offering.section.id, schoolYearId: offering.schoolYearId, status: EnrollmentStatus.ENROLLED },
          take: MAX_EXPORT_ROWS + 1,
          orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { student: { id: "asc" } }],
          select: { student: { select: { ...studentRosterSelect, id: true } } },
        }),
      ]);
      const students = enrollments.map(({ student }) => student);
      const grades = students.length
        ? await prisma.grade.findMany({
          where: {
            classOfferingId: offering.id,
            termId: { in: terms.map(({ id }) => id) },
            studentId: { in: students.map(({ id }) => id) },
          },
          select: { studentId: true, termId: true, score: true, remarks: true },
        })
        : [];
      return {
        filters,
        built: buildClassGrades(students, terms, grades.map((grade) => ({
          ...grade,
          score: Number(grade.score),
        }))),
        scopeParts: [offering.schoolYear.name, sectionLabel(offering.section.gradeLevel, offering.section.name), offering.subject.code],
      };
    },
  ),
  "section-grades": definition(
    {
      key: "section-grades",
      title: "Section Grades",
      description: "Term scores and general averages for an advisory section.",
      roles: all,
      filters: [
        { name: "sectionId", type: "section", required: true },
        { name: "termId", type: "term", required: true },
        { name: "includeUnreleased", type: "boolean", required: false, options: ["ADMIN only"] },
      ],
    },
    sectionGradesSchema,
    async (filters, user) => {
      const section = await prisma.section.findUnique({
        where: { id: filters.sectionId },
        select: {
          id: true, name: true, gradeLevel: true, schoolYearId: true, adviserId: true,
          schoolYear: { select: { id: true, name: true } },
        },
      });
      if (!section) throw new AppError("Section not found", 404, "NOT_FOUND");
      await assertCanAccessAdvisorySection(user, section.adviserId);
      const term = await prisma.term.findUnique({
        where: { id: filters.termId },
        select: { id: true, schoolYearId: true, gradesLocked: true },
      });
      if (!term || term.schoolYearId !== section.schoolYear.id) {
        throw new AppError("Term does not belong to this section's school year", 400, "TERM_NOT_IN_SCHOOL_YEAR");
      }
      const includesUnreleased = user.role === Role.ADMIN && (filters.includeUnreleased ?? false);
      if (!term.gradesLocked && !includesUnreleased) {
        throw new AppError("This term has not been released. Ask an administrator to release grades before exporting.", 409, "TERM_NOT_RELEASED");
      }
      const [classOfferings, enrollments] = await Promise.all([
        prisma.classOffering.findMany({
          where: { sectionId: section.id, schoolYearId: section.schoolYearId },
          orderBy: [{ subject: { code: "asc" } }, { id: "asc" }],
          select: { id: true, subject: { select: { code: true } } },
        }),
        prisma.enrollment.findMany({
          where: { sectionId: section.id, schoolYearId: section.schoolYearId, status: EnrollmentStatus.ENROLLED },
          take: MAX_EXPORT_ROWS + 1,
          orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { student: { id: "asc" } }],
          select: { student: { select: { id: true, studentNo: true, lastName: true, firstName: true } } },
        }),
      ]);
      const students = enrollments.map(({ student }) => student);
      const grades = classOfferings.length && students.length
        ? await prisma.grade.findMany({
          where: {
            termId: term.id,
            classOfferingId: { in: classOfferings.map(({ id }) => id) },
            studentId: { in: students.map(({ id }) => id) },
          },
          select: { studentId: true, classOfferingId: true, score: true },
        })
        : [];
      return {
        filters: { ...filters, includeUnreleased: includesUnreleased },
        built: buildSectionGrades(
          students,
          classOfferings.map(({ id, subject }) => ({ id, code: subject.code })),
          grades.map((grade) => ({ ...grade, score: Number(grade.score) })),
        ),
        scopeParts: [section.schoolYear.name, sectionLabel(section.gradeLevel, section.name)],
        draft: includesUnreleased,
        includesUnreleased,
      };
    },
  ),
  "teachers-list": definition(
    {
      key: "teachers-list",
      title: "Teachers List",
      description: "Teacher records, current-year class counts, and advisory sections.",
      roles: admin,
      filters: [{ name: "isActive", type: "boolean", required: false }],
    },
    teachersListSchema,
    async (filters) => {
      const [currentYear, teachers] = await Promise.all([
        prisma.schoolYear.findFirst({
          where: { isCurrent: true },
          select: { id: true, name: true },
        }),
        prisma.teacher.findMany({
          where: filters.isActive === undefined ? {} : { isActive: filters.isActive },
          take: MAX_EXPORT_ROWS + 1,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
          select: {
            id: true,
            employeeNo: true, firstName: true, middleName: true, lastName: true,
            department: true, isActive: true, userId: true,
          },
        }),
      ]);
      const [classCounts, advisorySections] = currentYear
        ? await Promise.all([
          prisma.classOffering.groupBy({
            by: ["teacherId"],
            where: { schoolYearId: currentYear.id },
            _count: { _all: true },
          }),
          prisma.section.findMany({
            where: { schoolYearId: currentYear.id, adviserId: { not: null } },
            orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
            select: { adviserId: true, gradeLevel: true, name: true },
          }),
        ])
        : [[], []];
      const classesByTeacher = new Map(classCounts.map(({ teacherId, _count }) => [teacherId, _count._all]));
      const sectionByTeacher = new Map<string, string>();
      for (const section of advisorySections) {
        if (section.adviserId && !sectionByTeacher.has(section.adviserId)) {
          sectionByTeacher.set(section.adviserId, sectionLabel(section.gradeLevel, section.name));
        }
      }
      return {
        filters,
        built: buildTeachersList(teachers.map((teacher) => ({
          employeeNo: teacher.employeeNo,
          firstName: teacher.firstName,
          middleName: teacher.middleName,
          lastName: teacher.lastName,
          department: teacher.department,
          isActive: teacher.isActive,
          userId: teacher.userId,
          classCount: classesByTeacher.get(teacher.id) ?? 0,
          advisorySection: sectionByTeacher.get(teacher.id) ?? null,
        }))),
        scopeParts: [currentYear?.name],
      };
    },
  ),
  "audit-log": definition(
    {
      key: "audit-log",
      title: "Audit Log",
      description: "Audit activity within a required date range.",
      roles: admin,
      filters: [
        { name: "from", type: "date", required: true },
        { name: "to", type: "date", required: true },
        { name: "action", type: "string", required: false },
        { name: "entity", type: "string", required: false },
      ],
    },
    auditLogSchema,
    async (filters) => {
      const rangeDays = (parseDateString(filters.to).getTime() - parseDateString(filters.from).getTime()) / 86_400_000;
      if (rangeDays > 30) {
        throw new AppError("Audit export date range cannot exceed 31 calendar days", 400, "DATE_RANGE_TOO_LARGE");
      }
      const rows = await prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: manilaStartOfDay(filters.from),
            lt: manilaStartOfNextDay(filters.to),
          },
          ...(filters.action ? { action: filters.action } : {}),
          ...(filters.entity ? { entity: filters.entity } : {}),
        },
        take: MAX_EXPORT_ROWS + 1,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          createdAt: true, action: true, entity: true, entityId: true, ipAddress: true,
          user: { select: { email: true, role: true } },
        },
      });
      return {
        filters,
        built: buildAuditLog(rows),
        scopeParts: [],
      };
    },
  ),
};

const studentRosterSelect = {
  studentNo: true,
  firstName: true,
  middleName: true,
  lastName: true,
  sex: true,
} as const;

export function getReportCatalog(role: Role) {
  return Object.values(reports)
    .filter((report) => report.roles.includes(role))
    .map(({ key, title, description, filters }) => ({ key, title, description, filters }));
}

export function enforceExportRowLimit(total: number, maximum = MAX_EXPORT_ROWS): void {
  if (total > maximum) {
    throw new AppError("Export contains too many rows. Narrow the filters and try again.", 413, "EXPORT_TOO_LARGE");
  }
}

export async function exportReport(
  key: string,
  rawFilters: unknown,
  preview: boolean,
  user: ReportUser,
  request: { ip?: string },
  response: {
    status(code: number): { json(body: unknown): unknown };
    setHeader(name: string, value: string): void;
    send(body: string): unknown;
  },
): Promise<void> {
  const report = reports[key];
  if (!report) throw new AppError("Report not found", 404, "REPORT_NOT_FOUND");
  if (!report.roles.includes(user.role)) throw new AppError("Forbidden", 403, "FORBIDDEN");

  const prepared = await report.prepare(rawFilters, user);
  enforceExportRowLimit(prepared.built.rows.length);
  const generatedAt = new Date().toISOString();
  if (preview) {
    response.status(200).json({
      report: report.key,
      filters: prepared.filters,
      total: prepared.built.rows.length,
      columns: prepared.built.columns,
      rows: prepared.built.rows.slice(0, 10),
      generatedAt,
    });
    return;
  }

  const filename = buildReportFilename(key, prepared.scopeParts, todayInManila(), prepared.draft);
  const csv = writeCsv(
    prepared.built.rows.map((row) => prepared.built.columns.map(({ key: columnKey }) => row[columnKey])),
    prepared.built.columns.map(({ label }) => label),
  );
  // Audit-log downloads are recorded here too; previews return before reaching this audit.
  await logAudit({
    userId: user.id,
    action: "EXPORT",
    entity: "Report",
    entityId: key,
    details: redactSensitive({
      filters: prepared.filters,
      rowCount: prepared.built.rows.length,
      ...(prepared.includesUnreleased ? { includesUnreleased: true } : {}),
      ...(prepared.includesContactDetails ? { includesContactDetails: true } : {}),
    }) as Prisma.InputJsonValue,
    ipAddress: request.ip,
  });
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.send(csv);
}

function assertCanAccessAdvisorySection(user: ReportUser, adviserId: string | null): Promise<void> {
  if (user.role === Role.ADMIN) return Promise.resolve();
  return getTeacherIdForUser(user.id).then((teacherId) => {
    if (teacherId !== adviserId) throw new AppError("Forbidden", 403, "FORBIDDEN");
  });
}

async function resolveSchoolYear(schoolYearId?: string) {
  const schoolYear = schoolYearId
    ? await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
    : await prisma.schoolYear.findFirst({
      where: { isCurrent: true },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
  if (!schoolYear) {
    throw new AppError(
      schoolYearId ? "School year not found" : "No current school year is configured",
      404,
      schoolYearId ? "NOT_FOUND" : "NO_CURRENT_SCHOOL_YEAR",
    );
  }
  return schoolYear;
}

function sectionLabel(gradeLevel: number, name: string): string {
  return `grade-${gradeLevel}-${name}`;
}

function validateSchoolYearDateRange(from: string, to: string, start: string, end: string, today: string): void {
  if (from > to) throw new AppError("from must be on or before to", 400, "INVALID_DATE_RANGE");
  if (from < start || to > end) {
    throw new AppError("Attendance date range must stay within the class school year", 400, "OUTSIDE_SCHOOL_YEAR");
  }
  if (to > today) throw new AppError("Attendance date range cannot include future dates", 400, "FUTURE_DATE");
}

function nextUtcDate(date: string): Date {
  const parsed = parseDateString(date);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed;
}

function manilaStartOfDay(date: string): Date {
  return new Date(parseDateString(date).getTime() - 8 * 60 * 60 * 1000);
}

function manilaStartOfNextDay(date: string): Date {
  return new Date(nextUtcDate(date).getTime() - 8 * 60 * 60 * 1000);
}
