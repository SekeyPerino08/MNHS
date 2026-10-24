import { EnrollmentStatus, Prisma, StudentStatus } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  listEnrollmentsQuerySchema,
  unassignedStudentsQuerySchema,
  type CreateEnrollmentInput,
  type UpdateEnrollmentStatusInput,
} from "./enrollment.schema.js";

type EnrollmentTransaction = Prisma.TransactionClient;

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function throwEnrollmentError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("Enrollment not found", 404);
  if (isKnownError(error, "P2002")) {
    throw new AppError("The student already has an enrollment for this school year", 409, "ALREADY_ENROLLED");
  }
  if (isKnownError(error, "P2003")) throw new AppError("The referenced student or section does not exist", 400, "INVALID_REFERENCE");
  throw error;
}

function parseQuery<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, {
      errors: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

async function resolveSchoolYearId(schoolYearId?: string, transaction = prisma): Promise<string> {
  if (schoolYearId) {
    const schoolYear = await transaction.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } });
    if (!schoolYear) throw new AppError("School year not found", 404);
    return schoolYear.id;
  }
  const current = await transaction.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return current.id;
}

async function enrollOne(
  transaction: EnrollmentTransaction,
  studentId: string,
  section: { id: string; name: string; schoolYearId: string },
) {
  const student = await transaction.student.findUnique({
    where: { id: studentId },
    select: { id: true, status: true },
  });
  if (!student) throw new AppError("Student not found", 404, "STUDENT_NOT_FOUND");
  if (student.status !== StudentStatus.ACTIVE) {
    throw new AppError("Only active students can be enrolled", 400, "STUDENT_NOT_ACTIVE");
  }

  const existing = await transaction.enrollment.findUnique({
    where: { studentId_schoolYearId: { studentId, schoolYearId: section.schoolYearId } },
    include: { section: { select: { name: true } } },
  });
  if (existing?.status === EnrollmentStatus.ENROLLED) {
    const currentSectionName = existing.section?.name ?? "an unassigned section";
    throw new AppError(
      `Student is already enrolled in ${currentSectionName}`,
      409,
      "ALREADY_ENROLLED",
      { currentSectionName },
    );
  }
  if (existing?.status === EnrollmentStatus.COMPLETED) {
    throw new AppError("The student's enrollment for this school year is already completed", 409, "ALREADY_COMPLETED");
  }
  if (existing) {
    return transaction.enrollment.update({
      where: { id: existing.id },
      data: { sectionId: section.id, status: EnrollmentStatus.ENROLLED, enrolledAt: new Date() },
      include: {
        student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
        section: { select: { id: true, name: true, gradeLevel: true } },
        schoolYear: { select: { id: true, name: true } },
      },
    });
  }
  return transaction.enrollment.create({
    data: { studentId, sectionId: section.id, schoolYearId: section.schoolYearId },
    include: {
      student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true } },
    },
  });
}

async function getSectionForEnrollment(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, schoolYearId: true },
  });
  if (!section) throw new AppError("Section not found", 404);
  return section;
}

export async function createEnrollment(input: CreateEnrollmentInput, request?: Request) {
  const section = await getSectionForEnrollment(input.sectionId);
  try {
    const enrollment = await prisma.$transaction((transaction) =>
      enrollOne(transaction, input.studentId, section),
    );
    await logAudit({
      userId: request?.user?.id,
      action: "ENROLL",
      entity: "Enrollment",
      entityId: enrollment.id,
      details: { studentId: input.studentId, sectionId: section.id, schoolYearId: section.schoolYearId },
      ipAddress: request?.ip,
    });
    return enrollment;
  } catch (error) {
    if (isKnownError(error, "P2002")) {
      const current = await prisma.enrollment.findUnique({
        where: { studentId_schoolYearId: { studentId: input.studentId, schoolYearId: section.schoolYearId } },
        include: { section: { select: { name: true } } },
      });
      const currentSectionName = current?.section?.name ?? "an unassigned section";
      throw new AppError(
        `Student is already enrolled in ${currentSectionName}`,
        409,
        "ALREADY_ENROLLED",
        { currentSectionName },
      );
    }
    throwEnrollmentError(error);
  }
}

async function enrollmentFailure(
  error: unknown,
  studentId: string,
  schoolYearId: string,
): Promise<{ studentId: string; reason: string; code?: string }> {
  if (error instanceof AppError) {
    return { studentId, reason: error.message, ...(error.code ? { code: error.code } : {}) };
  }
  if (isKnownError(error, "P2002")) {
    const current = await prisma.enrollment.findUnique({
      where: { studentId_schoolYearId: { studentId, schoolYearId } },
      include: { section: { select: { name: true } } },
    });
    const sectionName = current?.section?.name ?? "an unassigned section";
    return {
      studentId,
      reason: `Student is already enrolled in ${sectionName}`,
      code: "ALREADY_ENROLLED",
    };
  }
  if (isKnownError(error, "P2003") || isKnownError(error, "P2025")) {
    return { studentId, reason: "The student or section no longer exists", code: "STUDENT_NOT_FOUND" };
  }
  throw error;
}

export async function bulkEnroll(
  input: { sectionId: string; studentIds: string[] },
  request?: Request,
) {
  const section = await getSectionForEnrollment(input.sectionId);
  const results = await Promise.all(
    input.studentIds.map(async (studentId) => {
      try {
        const enrollment = await prisma.$transaction((transaction) =>
          enrollOne(transaction, studentId, section),
        );
        return { enrollment };
      } catch (error) {
        if (
          error instanceof AppError
          || isKnownError(error, "P2002")
          || isKnownError(error, "P2003")
          || isKnownError(error, "P2025")
        ) {
          return { skipped: await enrollmentFailure(error, studentId, section.schoolYearId) };
        }
        throw error;
      }
    }),
  );
  const enrolled = results.flatMap((result) => ("enrollment" in result ? [result.enrollment] : []));
  const skipped = results.flatMap((result) => ("skipped" in result ? [result.skipped] : []));
  await logAudit({
    userId: request?.user?.id,
    action: "BULK_ENROLL",
    entity: "Section",
    entityId: section.id,
    details: { enrolledCount: enrolled.length, skippedCount: skipped.length },
    ipAddress: request?.ip,
  });
  return { enrolled, skipped };
}

export async function transferEnrollment(id: string, sectionId: string, request?: Request) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const enrollment = await transaction.enrollment.findUnique({
        where: { id },
        include: { section: { select: { id: true, name: true, schoolYearId: true } } },
      });
      if (!enrollment) throw new AppError("Enrollment not found", 404);
      if (enrollment.status !== EnrollmentStatus.ENROLLED) {
        throw new AppError("Only currently enrolled students can be transferred", 400, "ENROLLMENT_NOT_ACTIVE");
      }
      const nextSection = await transaction.section.findUnique({
        where: { id: sectionId },
        select: { id: true, name: true, schoolYearId: true },
      });
      if (!nextSection) throw new AppError("Section not found", 404);
      if (nextSection.schoolYearId !== enrollment.schoolYearId) {
        throw new AppError("A student can only be transferred within the same school year", 400, "DIFFERENT_SCHOOL_YEAR");
      }
      if (nextSection.id === enrollment.sectionId) {
        throw new AppError("The student is already in this section", 400, "SAME_SECTION");
      }
      // Attendance and grades remain with their original class offerings to preserve the historical class record.
      const updated = await transaction.enrollment.update({
        where: { id },
        data: { sectionId: nextSection.id },
      });
      return { updated, oldSection: enrollment.section, nextSection };
    });
    await logAudit({
      userId: request?.user?.id,
      action: "TRANSFER",
      entity: "Enrollment",
      entityId: id,
      details: {
        oldSection: result.oldSection,
        newSection: { id: result.nextSection.id, name: result.nextSection.name },
      },
      ipAddress: request?.ip,
    });
    return result.updated;
  } catch (error) {
    throwEnrollmentError(error);
  }
}

export async function updateEnrollmentStatus(
  id: string,
  input: UpdateEnrollmentStatusInput,
  request?: Request,
) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.enrollment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) throw new AppError("Enrollment not found", 404);
      const updated = await transaction.enrollment.update({
        where: { id },
        data: { status: input.status },
      });
      return { updated, previousStatus: existing.status };
    });
    await logAudit({
      userId: request?.user?.id,
      action: "STATUS_CHANGE",
      entity: "Enrollment",
      entityId: id,
      details: {
        before: result.previousStatus,
        after: input.status,
        reason: input.reason ?? null,
      },
      ipAddress: request?.ip,
    });
    return result.updated;
  } catch (error) {
    throwEnrollmentError(error);
  }
}

export async function listEnrollments(rawQuery: unknown) {
  const query = parseQuery(listEnrollmentsQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  const schoolYearId = await resolveSchoolYearId(query.schoolYearId);
  const where: Prisma.EnrollmentWhereInput = {
    schoolYearId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.gradeLevel !== undefined ? { section: { is: { gradeLevel: query.gradeLevel } } } : {}),
    ...(query.search
      ? {
          student: {
            OR: [
              { studentNo: { contains: query.search, mode: "insensitive" } },
              { firstName: { contains: query.search, mode: "insensitive" } },
              { middleName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
  const orderBy: Prisma.EnrollmentOrderByWithRelationInput[] = [
    query.sortBy === "studentNo"
      ? { student: { studentNo: query.order } }
      : query.sortBy === "lastName"
        ? { student: { lastName: query.order } }
        : { [query.sortBy]: query.order },
    { id: "asc" },
  ];
  const [data, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        student: {
          select: {
            id: true,
            studentNo: true,
            firstName: true,
            middleName: true,
            lastName: true,
            status: true,
          },
        },
        section: { select: { id: true, name: true, gradeLevel: true } },
        schoolYear: { select: { id: true, name: true, isCurrent: true } },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);
  return { data, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}

export async function listUnassignedStudents(rawQuery: unknown) {
  const query = parseQuery(unassignedStudentsQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  const schoolYearId = await resolveSchoolYearId(query.schoolYearId);
  const where: Prisma.StudentWhereInput = {
    status: StudentStatus.ACTIVE,
    enrollments: {
      none: { schoolYearId, status: EnrollmentStatus.ENROLLED },
    },
    ...(query.search
      ? {
          OR: [
            { studentNo: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { middleName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        studentNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        sex: true,
        status: true,
      },
    }),
    prisma.student.count({ where }),
  ]);
  return { data, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}
