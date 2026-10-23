import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { signToken } from "../utils/jwt.js";

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
      profile: { type: "student", ...user.student },
    };
  }
  if (user.teacher) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: { type: "teacher", ...user.teacher },
    };
  }
  return { id: user.id, email: user.email, role: user.role, profile: null };
}

export async function login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: authUserInclude,
  });
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordMatches = await bcrypt.compare(password, passwordHash);
  if (!user || !user.isActive || !passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  return {
    user: toPublicUser(user),
    token: signToken({ sub: user.id, role: user.role }),
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

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError("Current password is incorrect", 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
