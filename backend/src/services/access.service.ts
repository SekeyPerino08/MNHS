import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export async function getTeacherIdForUser(userId: string): Promise<string> {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) throw new AppError("Teacher profile not found", 404, "TEACHER_PROFILE_NOT_FOUND");
  return teacher.id;
}

export async function assertCanAccessClassOffering(
  user: AuthenticatedUser,
  classOfferingId: string,
): Promise<void> {
  const offering = await prisma.classOffering.findUnique({
    where: { id: classOfferingId },
    select: { teacherId: true },
  });
  if (!offering) throw new AppError("Class offering not found", 404);
  if (user.role === Role.ADMIN) return;
  if (user.role !== Role.TEACHER) throw new AppError("Forbidden", 403, "FORBIDDEN");

  const teacher = await prisma.teacher.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!teacher || teacher.id !== offering.teacherId) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
}
