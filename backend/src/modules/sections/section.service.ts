import { EnrollmentStatus, Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { listSectionsQuerySchema, type CreateSectionInput, type UpdateSectionInput } from "./section.schema.js";

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function handleSectionError(
  error: unknown,
  adviserContext?: { adviserId?: string | null; schoolYearId?: string; excludeId?: string },
): Promise<never> {
  if (isKnownError(error, "P2025")) throw new AppError("Section not found", 404);
  if (isKnownError(error, "P2002")) {
    const target = error.meta?.target;
    const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
    if (targetText.includes("adviserId")) {
      const otherSection = adviserContext?.adviserId && adviserContext.schoolYearId
        ? await prisma.section.findFirst({
            where: {
              adviserId: adviserContext.adviserId,
              schoolYearId: adviserContext.schoolYearId,
              ...(adviserContext.excludeId ? { id: { not: adviserContext.excludeId } } : {}),
            },
            select: { name: true, gradeLevel: true },
          })
        : null;
      throw new AppError(
        otherSection
          ? `This teacher is already adviser of ${otherSection.name} (Grade ${otherSection.gradeLevel}) for this school year`
          : "This teacher is already assigned as adviser for this school year",
        409,
        "ADVISER_ALREADY_ASSIGNED",
        otherSection ? { sectionName: otherSection.name, gradeLevel: otherSection.gradeLevel } : undefined,
      );
    }
    throw new AppError("A section with this name and grade already exists for the school year", 409, "SECTION_EXISTS");
  }
  if (isKnownError(error, "P2003")) {
    throw new AppError("The referenced school year or adviser does not exist", 400, "INVALID_REFERENCE");
  }
  throw error;
}

async function assertAdviserAvailable(
  transaction: Prisma.TransactionClient,
  adviserId: string | null | undefined,
  schoolYearId: string,
  currentSectionId?: string,
) {
  if (!adviserId) return;
  const teacher = await transaction.teacher.findUnique({
    where: { id: adviserId },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  });
  if (!teacher) throw new AppError("Adviser teacher not found", 404);
  if (!teacher.isActive) throw new AppError("The adviser must be an active teacher", 400, "ADVISER_INACTIVE");
  const otherSection = await transaction.section.findFirst({
    where: {
      adviserId,
      schoolYearId,
      ...(currentSectionId ? { id: { not: currentSectionId } } : {}),
    },
    select: { name: true, gradeLevel: true },
  });
  if (otherSection) {
    throw new AppError(
      `This teacher is already adviser of ${otherSection.name} (Grade ${otherSection.gradeLevel}) for this school year`,
      409,
      "ADVISER_ALREADY_ASSIGNED",
      { sectionName: otherSection.name, gradeLevel: otherSection.gradeLevel },
    );
  }
}

function auditDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(after)
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => [key, { before: before[key] ?? null, after: value ?? null }]),
  ) as Prisma.InputJsonObject;
}

export async function listSections(rawQuery: unknown) {
  const parsed = listSectionsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  let schoolYearId = query.schoolYearId;
  if (!schoolYearId) {
    const current = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
    if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
    schoolYearId = current.id;
  }
  const where: Prisma.SectionWhereInput = {
    schoolYearId,
    ...(query.gradeLevel === undefined ? {} : { gradeLevel: query.gradeLevel }),
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
  };
  const [sections, total] = await prisma.$transaction([
    prisma.section.findMany({
      where,
      skip,
      take,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      include: {
        schoolYear: { select: { id: true, name: true, isCurrent: true } },
        adviser: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
        _count: {
          select: {
            enrollments: { where: { status: EnrollmentStatus.ENROLLED } },
            classOfferings: true,
          },
        },
      },
    }),
    prisma.section.count({ where }),
  ]);
  return { data: sections, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}

export async function getSectionById(id: string) {
  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      schoolYear: { select: { id: true, name: true, isCurrent: true } },
      adviser: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true, isActive: true } },
      enrollments: {
        where: { status: EnrollmentStatus.ENROLLED },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        select: {
          id: true,
          status: true,
          student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
        },
      },
      classOfferings: {
        orderBy: [{ term: { termNumber: "asc" } }, { subject: { name: "asc" } }],
        include: {
          subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
          term: { select: { id: true, name: true, termNumber: true } },
        },
      },
    },
  });
  if (!section) throw new AppError("Section not found", 404);
  return section;
}

export async function createSection(input: CreateSectionInput, request?: Request) {
  let assignedSchoolYearId = input.schoolYearId;
  try {
    const section = await prisma.$transaction(async (transaction) => {
      let schoolYearId = input.schoolYearId;
      if (!schoolYearId) {
        const current = await transaction.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
        if (!current) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
        schoolYearId = current.id;
      }
      assignedSchoolYearId = schoolYearId;
      await assertAdviserAvailable(transaction, input.adviserId, schoolYearId);
      return transaction.section.create({
        data: { ...input, schoolYearId },
        include: { adviser: { select: { id: true, firstName: true, lastName: true } } },
      });
    });
    await logAudit({
      userId: request?.user?.id,
      action: "CREATE",
      entity: "Section",
      entityId: section.id,
      details: { name: section.name, gradeLevel: section.gradeLevel, schoolYearId: section.schoolYearId, adviserId: section.adviserId },
      ipAddress: request?.ip,
    });
    return section;
  } catch (error) {
    await handleSectionError(error, { adviserId: input.adviserId, schoolYearId: assignedSchoolYearId });
  }
}

export async function updateSection(id: string, input: UpdateSectionInput, request?: Request) {
  let adviserContext: { adviserId?: string | null; schoolYearId?: string } = {};
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const before = await transaction.section.findUnique({ where: { id } });
      if (!before) throw new AppError("Section not found", 404);
      const enrollmentCount = await transaction.enrollment.count({ where: { sectionId: id } });
      const movesSection = (input.schoolYearId !== undefined && input.schoolYearId !== before.schoolYearId) ||
        (input.gradeLevel !== undefined && input.gradeLevel !== before.gradeLevel);
      if (movesSection && enrollmentCount > 0) {
        throw new AppError("School year or grade level cannot be changed while the section has enrollments", 409, "SECTION_HAS_ENROLLMENTS", { enrollmentCount });
      }
      const schoolYearId = input.schoolYearId ?? before.schoolYearId;
      const adviserId = input.adviserId === undefined ? before.adviserId : input.adviserId;
      adviserContext = { adviserId, schoolYearId };
      await assertAdviserAvailable(transaction, adviserId, schoolYearId, id);
      const section = await transaction.section.update({ where: { id }, data: input });
      return { section, before };
    });
    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "Section",
      entityId: id,
      details: auditDiff(result.before as unknown as Record<string, unknown>, input as Record<string, unknown>),
      ipAddress: request?.ip,
    });
    return result.section;
  } catch (error) {
    await handleSectionError(error, { ...adviserContext, excludeId: id });
  }
}

export async function deleteSection(id: string, request?: Request) {
  try {
    const removed = await prisma.$transaction(async (transaction) => {
      const section = await transaction.section.findUnique({ where: { id }, select: { id: true, name: true, gradeLevel: true } });
      if (!section) throw new AppError("Section not found", 404);
      const [enrollmentCount, classOfferingCount] = await Promise.all([
        transaction.enrollment.count({ where: { sectionId: id } }),
        transaction.classOffering.count({ where: { sectionId: id } }),
      ]);
      if (enrollmentCount || classOfferingCount) {
        throw new AppError(
          `Section is in use: ${enrollmentCount} enrollments and ${classOfferingCount} class offerings`,
          409,
          "SECTION_IN_USE",
          { enrollmentCount, classOfferingCount },
        );
      }
      await transaction.section.delete({ where: { id } });
      return section;
    });
    await logAudit({
      userId: request?.user?.id,
      action: "DELETE",
      entity: "Section",
      entityId: id,
      details: { name: removed.name, gradeLevel: removed.gradeLevel },
      ipAddress: request?.ip,
    });
  } catch (error) {
    if (isKnownError(error, "P2003")) {
      const [enrollmentCount, classOfferingCount] = await Promise.all([
        prisma.enrollment.count({ where: { sectionId: id } }),
        prisma.classOffering.count({ where: { sectionId: id } }),
      ]);
      throw new AppError(
        `Section is in use: ${enrollmentCount} enrollments and ${classOfferingCount} class offerings`,
        409,
        "SECTION_IN_USE",
        { enrollmentCount, classOfferingCount },
      );
    }
    await handleSectionError(error);
  }
}
