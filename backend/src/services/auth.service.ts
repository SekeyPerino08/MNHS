import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { signToken } from "../utils/jwt.js";
import { logAudit } from "./audit.service.js";
import { isAccountLocked, nextLoginFailureState, passwordPolicyError } from "../utils/password-policy.js";

const authUserInclude = {
  student: {
    select: { studentNo: true, firstName: true, middleName: true, lastName: true },
  },
  teacher: {
    select: { employeeNo: true, firstName: true, middleName: true, lastName: true },
  },
} satisfies Prisma.UserInclude;

type AuthUser = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;

const dummyPasswordHash = bcrypt.hash("invalid-login-dummy-value", 12);

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  profile:
    | { type: "student"; studentNo: string; firstName: string; middleName: string | null; lastName: string }
    | { type: "teacher"; employeeNo: string; firstName: string; middleName: string | null; lastName: string }
    | null;
}

export function toPublicUser(user: AuthUser): PublicUser {
  if (user.student) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      profile: { type: "student", ...user.student },
    };
  }
  if (user.teacher) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      profile: { type: "teacher", ...user.teacher },
    };
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    profile: null,
  };
}

export async function login(
  email: string,
  password: string,
  ipAddress?: string,
): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: authUserInclude,
  });
  const now = new Date();
  if (!user) {
    await bcrypt.compare(password, await dummyPasswordHash);
    await logAudit({ action: "LOGIN_FAILED", entity: "User", ipAddress });
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive || isAccountLocked(user.lockedUntil, now)) {
    await bcrypt.compare(password, await dummyPasswordHash);
    await logAudit({
      userId: user.id,
      action: "LOGIN_BLOCKED",
      entity: "User",
      entityId: user.id,
      ipAddress,
    });
    throw new AppError("Invalid email or password", 401);
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await prisma.$transaction(async (tx) => {
      const incremented = await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
      const failureState = nextLoginFailureState(incremented.failedLoginCount - 1, now);
      const shouldLock = failureState.lockedUntil !== null;
      if (shouldLock) {
        await tx.user.update({
          where: { id: user.id },
          data: failureState,
        });
      }
      await logAudit({
        userId: user.id,
        action: "LOGIN_FAILED",
        entity: "User",
        entityId: user.id,
        ipAddress,
      }, tx);
      if (shouldLock) {
        await logAudit({
          userId: user.id,
          action: "ACCOUNT_LOCKED",
          entity: "User",
          entityId: user.id,
          ipAddress,
        }, tx);
      }
    });
    throw new AppError("Invalid email or password", 401);
  }

  const signedInUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      include: authUserInclude,
    });
    await logAudit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ipAddress,
    }, tx);
    return updated;
  });
  return {
    user: toPublicUser(signedInUser),
    token: signToken({ sub: user.id, role: user.role, ver: signedInUser.tokenVersion }),
  };
}

export async function getAuthUser(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: authUserInclude,
  });
  if (!user || !user.isActive) {
    throw new AppError("Not authenticated", 401);
  }
  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError("Current password is incorrect", 401);
  }

  const policyError = passwordPolicyError(newPassword, currentPassword, user.email);
  if (policyError) throw new AppError(policyError, 400);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });
    await logAudit({ userId, action: "PASSWORD_CHANGE", entity: "User", entityId: userId, ipAddress }, tx);
    return result;
  });
  return signToken({ sub: updated.id, role: updated.role, ver: updated.tokenVersion });
}

export async function logoutAll(userId: string, ipAddress?: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    await logAudit({ userId, action: "LOGOUT_ALL", entity: "User", entityId: userId, ipAddress }, tx);
  });
}
