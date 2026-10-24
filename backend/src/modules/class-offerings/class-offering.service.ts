import { EnrollmentStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { assertCanAccessClassOffering } from "../../services/access.service.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  listClassOfferingsQuerySchema,
  type CreateClassOfferingInput,
  type UpdateClassOfferingInput,
} from "./class-offering.schema.js";

type OfferingTransaction = Prisma.TransactionClient;

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function throwOfferingError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("Class offering not found", 404);
  if (isKnownError(error, "P2002")) {
    throw new AppError("This subject is already offered in the section for this school year", 409, "OFFERING_EXISTS");
  }
  if (isKnownError(error, "P2003")) throw new AppError("The referenced subject, section, or teacher does not exist", 400, "INVALID_REFERENCE");
  throw error;
}

function parseListQuery(raw: unknown) {
  const parsed = listClassOfferingsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  return parsed.data;
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

async function getSection(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true },
  });
  if (!section) throw new AppError("Section not found", 404);
  return section;
}

async function createOffering(
  transaction: OfferingTransaction,
  section: { id: string; gradeLevel: number; schoolYearId: string },
  item: { subjectId: string; teacherId: string },
) {
  const [subject, teacher] = await Promise.all([
    transaction.subject.findUnique({
      where: { id: item.subjectId },
      select: { id: true, name: true, gradeLevel: true },
    }),
    transaction.teacher.findUnique({
      where: { id: item.teacherId },
      select: { id: true, isActive: true },
    }),
  ]);
  if (!subject) throw new AppError("Subject not found", 404, "SUBJECT_NOT_FOUND");
  if (!teacher) throw new AppError("Teacher not found", 404, "TEACHER_NOT_FOUND");
  if (subject.gradeLevel !== section.gradeLevel) {
    throw new AppError(
      `Subject grade level ${subject.gradeLevel} does not match section grade level ${section.gradeLevel}`,
      400,
      "GRADE_LEVEL_MISMATCH",
    );
  }
  if (!teacher.isActive) throw new AppError("The assigned teacher must be active", 400, "TEACHER_NOT_ACTIVE");
  return transaction.classOffering.create({
    data: {
      subjectId: subject.id,
      sectionId: section.id,
      teacherId: teacher.id,
      schoolYearId: section.schoolYearId,
    },
    include: {
      subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
    },
  });
}

export async function createClassOffering(input: CreateClassOfferingInput, request?: Request) {
  const section = await getSection(input.sectionId);
  try {
    const offering = await prisma.$transaction((transaction) => createOffering(transaction, section, input));
    await logAudit({
      userId: request?.user?.id,
      action: "CREATE",
      entity: "ClassOffering",
      entityId: offering.id,
      details: { sectionId: section.id, subjectId: offering.subjectId, teacherId: offering.teacherId, schoolYearId: section.schoolYearId },
      ipAddress: request?.ip,
    });
    return offering;
  } catch (error) {
    throwOfferingError(error);
  }
}

function itemFailure(error: unknown): { reason: string; code?: string } {
  if (error instanceof AppError) return { reason: error.message, ...(error.code ? { code: error.code } : {}) };
  if (isKnownError(error, "P2002")) {
    return { reason: "This subject is already offered in the section for this school year", code: "OFFERING_EXISTS" };
  }
  if (isKnownError(error, "P2003") || isKnownError(error, "P2025")) {
    return { reason: "The subject or teacher no longer exists", code: "INVALID_REFERENCE" };
  }
  throw error;
}

export async function bulkCreateClassOfferings(
  input: { sectionId: string; items: Array<{ subjectId: string; teacherId: string }> },
  request?: Request,
) {
  const section = await getSection(input.sectionId);
  const results = await Promise.all(
    input.items.map(async (item) => {
      try {
        const offering = await prisma.$transaction((transaction) => createOffering(transaction, section, item));
        return { offering };
      } catch (error) {
        if (
          error instanceof AppError
          || isKnownError(error, "P2002")
          || isKnownError(error, "P2003")
          || isKnownError(error, "P2025")
        ) {
          return { skipped: { subjectId: item.subjectId, teacherId: item.teacherId, ...itemFailure(error) } };
        }
        throw error;
      }
    }),
  );
  const created = results.flatMap((result) => ("offering" in result ? [result.offering] : []));
  const skipped = results.flatMap((result) => ("skipped" in result ? [result.skipped] : []));
  await logAudit({
    userId: request?.user?.id,
    action: "BULK_CREATE",
    entity: "Section",
    entityId: section.id,
    details: { createdCount: created.length, skippedCount: skipped.length },
    ipAddress: request?.ip,
  });
  return { created, skipped };
}

export async function updateClassOffering(
  id: string,
  input: UpdateClassOfferingInput,
  request?: Request,
) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.classOffering.findUnique({
        where: { id },
        select: {
          id: true,
          teacher: { select: { id: true, employeeNo: true, firstName: true, lastName: true } },
        },
      });
      if (!existing) throw new AppError("Class offering not found", 404);
      const teacher = await transaction.teacher.findUnique({
        where: { id: input.teacherId },
        select: { id: true, employeeNo: true, firstName: true, lastName: true, isActive: true },
      });
      if (!teacher) throw new AppError("Teacher not found", 404);
      if (!teacher.isActive) throw new AppError("The assigned teacher must be active", 400, "TEACHER_NOT_ACTIVE");
      const updated = await transaction.classOffering.update({
        where: { id },
        data: { teacherId: teacher.id },
        include: {
          subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
          section: { select: { id: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
        },
      });
      return { updated, oldTeacher: existing.teacher, newTeacher: teacher };
    });
    // Existing attendance and grades retain their recordedBy history; changing the assigned teacher does not rewrite them.
    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "ClassOffering",
      entityId: id,
      details: { teacher: { before: result.oldTeacher, after: result.newTeacher } },
      ipAddress: request?.ip,
    });
    return result.updated;
  } catch (error) {
    throwOfferingError(error);
  }
}

export async function deleteClassOffering(id: string, request?: Request) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const offering = await transaction.classOffering.findUnique({
        where: { id },
        select: {
          id: true,
          subject: { select: { code: true, name: true } },
          section: { select: { name: true } },
          _count: { select: { attendance: true, grades: true } },
        },
      });
      if (!offering) throw new AppError("Class offering not found", 404);
      if (offering._count.attendance > 0 || offering._count.grades > 0) {
        throw new AppError(
          `This class offering has ${offering._count.attendance} attendance records and ${offering._count.grades} grades`,
          409,
          "OFFERING_IN_USE",
          { attendanceCount: offering._count.attendance, gradeCount: offering._count.grades },
        );
      }
      await transaction.classOffering.delete({ where: { id } });
      return offering;
    });
    await logAudit({
      userId: request?.user?.id,
      action: "DELETE",
      entity: "ClassOffering",
      entityId: id,
      details: { subject: result.subject, section: result.section },
      ipAddress: request?.ip,
    });
  } catch (error) {
    throwOfferingError(error);
  }
}

export async function listClassOfferings(rawQuery: unknown) {
  const query = parseListQuery(rawQuery);
  const { skip, take } = parsePagination(query);
  const schoolYearId = await resolveSchoolYearId(query.schoolYearId);
  const where: Prisma.ClassOfferingWhereInput = {
    schoolYearId,
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    ...(query.gradeLevel !== undefined ? { section: { gradeLevel: query.gradeLevel } } : {}),
  };
  const [offerings, total] = await prisma.$transaction([
    prisma.classOffering.findMany({
      where,
      skip,
      take,
      orderBy: [{ section: { gradeLevel: "asc" } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
      include: {
        subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
        section: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            _count: {
              select: {
                enrollments: {
                  where: { schoolYearId, status: EnrollmentStatus.ENROLLED },
                },
              },
            },
          },
        },
        teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
      },
    }),
    prisma.classOffering.count({ where }),
  ]);
  const data = offerings.map(({ section, ...offering }) => ({
    ...offering,
    section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
    enrolledStudentCount: section._count.enrollments,
  }));
  return { data, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}

const offeringDetailsInclude = {
  subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
  section: { select: { id: true, name: true, gradeLevel: true } },
  teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
};

export async function getClassOfferingById(id: string, user: { id: string; role: Role }) {
  await assertCanAccessClassOffering(user, id);
  const offering = await prisma.classOffering.findUnique({
    where: { id },
    include: offeringDetailsInclude,
  });
  if (!offering) throw new AppError("Class offering not found", 404);
  return offering;
}

export async function getClassOfferingStudents(id: string, user: { id: string; role: Role }) {
  await assertCanAccessClassOffering(user, id);
  const offering = await prisma.classOffering.findUnique({
    where: { id },
    select: { sectionId: true, schoolYearId: true },
  });
  if (!offering) throw new AppError("Class offering not found", 404);
  return prisma.student.findMany({
    where: {
      enrollments: {
        some: {
          sectionId: offering.sectionId,
          schoolYearId: offering.schoolYearId,
          status: EnrollmentStatus.ENROLLED,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      studentNo: true,
      firstName: true,
      middleName: true,
      lastName: true,
      sex: true,
    },
  });
}
