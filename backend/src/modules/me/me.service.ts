import { EnrollmentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getTeacherIdForUser } from "../../services/access.service.js";
import { AppError } from "../../utils/AppError.js";
import { myClassesQuerySchema } from "./me.schema.js";

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

export async function getMyClasses(userId: string, rawQuery: unknown) {
  const parsed = myClassesQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten().fieldErrors });
  }
  const [teacherId, schoolYearId] = await Promise.all([
    getTeacherIdForUser(userId),
    resolveSchoolYearId(parsed.data.schoolYearId),
  ]);
  const [classOfferings, advisedSection] = await Promise.all([
    prisma.classOffering.findMany({
      where: { teacherId, schoolYearId },
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
      },
    }),
    prisma.section.findFirst({
      where: { adviserId: teacherId, schoolYearId },
      select: { id: true, name: true, gradeLevel: true, schoolYear: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    data: classOfferings.map(({ section, ...offering }) => ({
      ...offering,
      section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
      enrolledStudentCount: section._count.enrollments,
    })),
    advisedSection,
  };
}

export async function getMyEnrollment(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!schoolYear) return { enrollment: null, classOfferings: [] };

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      schoolYearId: schoolYear.id,
      status: EnrollmentStatus.ENROLLED,
    },
    include: {
      section: {
        include: {
          adviser: {
            select: { id: true, firstName: true, middleName: true, lastName: true },
          },
        },
      },
      schoolYear: { select: { id: true, name: true, isCurrent: true } },
    },
  });
  if (!enrollment) return { enrollment: null, classOfferings: [] };
  if (!enrollment.section) return { enrollment, classOfferings: [] };
  const classOfferings = await prisma.classOffering.findMany({
    where: { sectionId: enrollment.section.id, schoolYearId: schoolYear.id },
    orderBy: { subject: { name: "asc" } },
    include: {
      subject: { select: { id: true, code: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
    },
  });
  return { enrollment, classOfferings };
}
