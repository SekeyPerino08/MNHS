import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { canDeactivateLastActiveAdmin, canDeactivateUser } from "../../utils/account-governance.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { passwordPolicyError } from "../../utils/password-policy.js";
import type {
  ChangeEmailBody,
  CreateAdminUserBody,
  ResetPasswordBody,
  UpdateUserStatusBody,
} from "./user.schema.js";
import { listUsersQuerySchema } from "./user.schema.js";

function makeTemporaryPassword(email: string): string {
  let password = "";
  do {
    password = `${randomBytes(24).toString("base64url")}A1`;
  } while (passwordPolicyError(password, "", email) !== null);
  return password;
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new AppError("Email is already in use", 409, "EMAIL_TAKEN");
    if (error.code === "P2025") throw new AppError("User not found", 404);
  }
  throw error;
}

export async function listUsers(input: unknown) {
  const parsed = listUsersQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const query = parsed.data;
  const { skip, take } = parsePagination(query);
  const now = new Date();
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    ...(query.state === "locked" ? { lockedUntil: { gt: now } } : {}),
    ...(query.state === "mustChange" ? { mustChangePassword: true } : {}),
  };
  if (query.search) {
    const search = query.search;
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      {
        student: {
          is: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { middleName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { studentNo: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        teacher: {
          is: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { middleName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { employeeNo: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: query.sortBy === "lastLoginAt"
        ? { lastLoginAt: { sort: query.order, nulls: "last" } }
        : { [query.sortBy]: query.order },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        student: { select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true } },
        teacher: { select: { id: true, employeeNo: true, firstName: true, middleName: true, lastName: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((user) => {
      const student = user.student;
      const teacher = user.teacher;
      const person = student
        ? {
            type: "STUDENT" as const,
            id: student.id,
            name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
            number: student.studentNo,
          }
        : teacher
          ? {
              type: "TEACHER" as const,
              id: teacher.id,
              name: [teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(" "),
              number: teacher.employeeNo,
            }
          : null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        isLocked: user.lockedUntil !== null && user.lockedUntil > now,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        person,
      };
    }),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}

export async function createAdminUser(input: CreateAdminUserBody, actorId: string, ipAddress?: string) {
  const temporaryPassword = input.temporaryPassword ?? makeTemporaryPassword(input.email);
  const policyError = passwordPolicyError(temporaryPassword, "", input.email);
  if (policyError) throw new AppError(policyError, 400);
  const duplicate = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new AppError("Email is already in use", 409, "EMAIL_TAKEN");
  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: Role.ADMIN,
          firstName: "Admin",
          lastName: "User",
          mustChangePassword: true,
        },
        select: { id: true, email: true, role: true, isActive: true, mustChangePassword: true },
      });
      await logAudit({
        userId: actorId,
        action: "USER_CREATED",
        entity: "User",
        entityId: created.id,
        details: { email: created.email, role: created.role },
        ipAddress,
      }, tx);
      return created;
    });
    return { user, temporaryPassword };
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function changeUserEmail(
  id: string,
  input: ChangeEmailBody,
  actorId: string,
  ipAddress?: string,
) {
  const existing = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!existing) throw new AppError("User not found", 404);
  const duplicate = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate && duplicate.id !== id) throw new AppError("Email is already in use", 409, "EMAIL_TAKEN");
  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { email: input.email },
        select: { id: true, email: true, role: true },
      });
      await logAudit({
        userId: actorId,
        action: "EMAIL_CHANGE",
        entity: "User",
        entityId: id,
        details: { oldEmail: existing.email, newEmail: updated.email },
        ipAddress,
      }, tx);
      return updated;
    });
    return user;
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function resetUserPassword(
  id: string,
  input: ResetPasswordBody,
  actorId: string,
  ipAddress?: string,
) {
  if (id === actorId) throw new AppError("Use the change-password endpoint for your own account", 400, "USE_CHANGE_PASSWORD");
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!target) throw new AppError("User not found", 404);
  const temporaryPassword = input.temporaryPassword ?? makeTemporaryPassword(target.email);
  const policyError = passwordPolicyError(temporaryPassword, "", target.email);
  if (policyError) throw new AppError(policyError, 400);
  try {
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          lockedUntil: null,
          failedLoginCount: 0,
          tokenVersion: { increment: 1 },
        },
      });
      await logAudit({ userId: actorId, action: "PASSWORD_RESET", entity: "User", entityId: id, ipAddress }, tx);
    });
    return { temporaryPassword };
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function updateUserStatus(
  id: string,
  input: UpdateUserStatusBody,
  actorId: string,
  ipAddress?: string,
) {
  if (!canDeactivateUser(actorId, id, input.isActive)) {
    throw new AppError("You cannot deactivate your own account", 400, "CANNOT_DEACTIVATE_SELF");
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: {
          email: true,
          role: true,
          isActive: true,
          student: { select: { status: true } },
          teacher: { select: { isActive: true } },
        },
      });
      if (!target) throw new AppError("User not found", 404);
      if (input.isActive && target.student && target.student.status !== "ACTIVE") {
        throw new AppError("Change the student's status from their own page before reactivating this account", 409, "PERSON_NOT_ACTIVE");
      }
      if (input.isActive && target.teacher && !target.teacher.isActive) {
        throw new AppError("Change the teacher's status from their own page before reactivating this account", 409, "PERSON_NOT_ACTIVE");
      }
      if (!canDeactivateUser(actorId, id, input.isActive)) {
        throw new AppError("You cannot deactivate your own account", 400, "CANNOT_DEACTIVATE_SELF");
      }
      if (!input.isActive && target.role === Role.ADMIN && target.isActive) {
        const activeAdminCount = await tx.user.count({ where: { role: Role.ADMIN, isActive: true } });
        if (!canDeactivateLastActiveAdmin(target.role, target.isActive, input.isActive, activeAdminCount)) {
          throw new AppError("The last active admin account cannot be deactivated", 409, "LAST_ADMIN");
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          isActive: input.isActive,
          ...(input.isActive ? {} : { tokenVersion: { increment: 1 } }),
        },
        select: { id: true, email: true, role: true, isActive: true },
      });
      await logAudit({
        userId: actorId,
        action: "STATUS_CHANGE",
        entity: "User",
        entityId: id,
        details: {
          isActive: input.isActive,
          ...(input.reason === undefined ? {} : { reason: input.reason }),
        },
        ipAddress,
      }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return result;
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function unlockUser(id: string, actorId: string, ipAddress?: string) {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const unlocked = await tx.user.update({
        where: { id },
        data: { lockedUntil: null, failedLoginCount: 0 },
        select: { id: true, email: true },
      });
      await logAudit({ userId: actorId, action: "ACCOUNT_UNLOCKED", entity: "User", entityId: id, ipAddress }, tx);
      return unlocked;
    });
    return user;
  } catch (error) {
    mapPrismaError(error);
  }
}

export async function forceLogoutUser(id: string, actorId: string, ipAddress?: string) {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
        select: { id: true, email: true },
      });
      await logAudit({ userId: actorId, action: "FORCE_LOGOUT", entity: "User", entityId: id, ipAddress }, tx);
      return updated;
    });
    return user;
  } catch (error) {
    mapPrismaError(error);
  }
}
