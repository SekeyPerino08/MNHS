import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { createPersonAccount, setLinkedUserActive } from "../../services/account.service.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import {
  listTeachersQuerySchema,
  type CreateTeacherAccountInput,
  type CreateTeacherInput,
  type UpdateTeacherInput,
  type UpdateTeacherStatusInput,
} from "./teacher.schema.js";

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function handleTeacherError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("Teacher not found", 404);
  if (isKnownError(error, "P2002")) {
    const target = error.meta?.target;
    if ((Array.isArray(target) && target.includes("employeeNo")) || String(target).includes("employeeNo")) {
      throw new AppError("A teacher with this employee number already exists", 409, "EMPLOYEE_NO_EXISTS");
    }
    throw new AppError("A teacher with these details already exists", 409);
  }
  throw error;
}

function requestIp(request?: Request) {
  return request?.ip;
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(after)
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => [key, { before: before[key] ?? null, after: value ?? null }]),
  ) as Prisma.InputJsonObject;
}

export async function listTeachers(rawQuery: unknown) {
  const parsed = listTeachersQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  const where: Prisma.TeacherWhereInput = {
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { employeeNo: { contains: query.search, mode: "insensitive" } },
            { department: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const currentYearId = currentYear?.id;
  const [teachers, total] = await prisma.$transaction([
    prisma.teacher.findMany({
      where,
      skip,
      take,
      orderBy: [{ [query.sortBy]: query.order }, { id: "asc" }],
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        middleName: true,
        lastName: true,
        department: true,
        contactNo: true,
        isActive: true,
        createdAt: true,
        userId: true,
        _count: {
          select: {
            offerings: { where: currentYearId ? { schoolYearId: currentYearId } : { id: "__none__" } },
            advisedSections: { where: currentYearId ? { schoolYearId: currentYearId } : { id: "__none__" } },
          },
        },
      },
    }),
    prisma.teacher.count({ where }),
  ]);
  return {
    data: teachers.map(({ userId, _count, ...teacher }) => ({
      ...teacher,
      hasAccount: userId !== null,
      classOfferingCount: _count.offerings,
      advisedSectionCount: _count.advisedSections,
    })),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function getTeacherById(id: string) {
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true }, select: { id: true } });
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      middleName: true,
      lastName: true,
      department: true,
      contactNo: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { email: true } },
      offerings: {
        where: year ? { schoolYearId: year.id } : { id: "__none__" },
        orderBy: { subject: { name: "asc" } },
        include: {
          subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
          section: { select: { id: true, name: true, gradeLevel: true } },
        },
      },
      advisedSections: {
        where: year ? { schoolYearId: year.id } : { id: "__none__" },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        select: { id: true, name: true, gradeLevel: true },
      },
    },
  });
  if (!teacher) throw new AppError("Teacher not found", 404);
  return teacher;
}

export async function createTeacher(input: CreateTeacherInput, request?: Request) {
  try {
    const teacher = await prisma.teacher.create({ data: input });
    await logAudit({
      userId: request?.user?.id,
      action: "CREATE",
      entity: "Teacher",
      entityId: teacher.id,
      details: input as Prisma.InputJsonObject,
      ipAddress: requestIp(request),
    });
    return teacher;
  } catch (error) {
    handleTeacherError(error);
  }
}

export async function updateTeacher(id: string, input: UpdateTeacherInput, request?: Request) {
  try {
    const before = await prisma.teacher.findUnique({ where: { id } });
    if (!before) throw new AppError("Teacher not found", 404);
    const teacher = await prisma.teacher.update({ where: { id }, data: input });
    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "Teacher",
      entityId: id,
      details: diff(before as unknown as Record<string, unknown>, input as Record<string, unknown>),
      ipAddress: requestIp(request),
    });
    return teacher;
  } catch (error) {
    handleTeacherError(error);
  }
}

export async function updateTeacherStatus(id: string, input: UpdateTeacherStatusInput, request?: Request) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const teacher = await transaction.teacher.findUnique({
        where: { id },
        select: { id: true, isActive: true, userId: true },
      });
      if (!teacher) throw new AppError("Teacher not found", 404);
      const updated = await transaction.teacher.update({ where: { id }, data: { isActive: input.isActive } });
      if (teacher.userId) await setLinkedUserActive(transaction, teacher.userId, input.isActive);
      return { updated, before: teacher.isActive };
    });
    await logAudit({
      userId: request?.user?.id,
      action: "STATUS_CHANGE",
      entity: "Teacher",
      entityId: id,
      details: { before: result.before, after: input.isActive, reason: input.reason ?? null },
      ipAddress: requestIp(request),
    });
    return result.updated;
  } catch (error) {
    handleTeacherError(error);
  }
}

export async function createTeacherAccount(id: string, input: CreateTeacherAccountInput, request?: Request) {
  const result = await createPersonAccount({
    kind: "teacher",
    personId: id,
    email: input.email,
    temporaryPassword: input.temporaryPassword,
  });
  await logAudit({
    userId: request?.user?.id,
    action: "ACCOUNT_CREATED",
    entity: "Teacher",
    entityId: id,
    details: { email: input.email },
    ipAddress: requestIp(request),
  });
  return { teacherId: id, ...result };
}
