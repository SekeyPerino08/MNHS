import { EnrollmentStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { assertCanAccessClassOffering, getTeacherIdForUser } from "../../services/access.service.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import {
  calculateFinalGrade,
  calculateGeneralAverage,
  getGradeDescriptor,
  isPassing,
} from "../../utils/grading.js";
import {
  gradeOverviewQuerySchema,
  gradeSummaryQuerySchema,
  saveGradesSchema,
  schoolYearQuerySchema,
  termLockSchema,
} from "./grades.schema.js";

type GradesUser = { id: string; role: Role };
type GradeValue = number | null;

function parseQuery<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  return parsed.data;
}

function numericScore(score: Prisma.Decimal | number | null): number | null {
  return score === null ? null : Number(score);
}

function handleGradeError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("A grade already exists for this student, class, and term", 409, "GRADE_EXISTS");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new AppError("Grade or related resource not found", 404);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    throw new AppError("The referenced student, term, or class offering does not exist", 400, "INVALID_REFERENCE");
  }
  throw error;
}

async function getOffering(classOfferingId: string) {
  const offering = await prisma.classOffering.findUnique({
    where: { id: classOfferingId },
    select: {
      id: true,
      sectionId: true,
      schoolYearId: true,
      subject: { select: { id: true, code: true, name: true } },
      section: { select: { id: true, name: true, gradeLevel: true } },
      teacher: { select: { id: true, firstName: true, middleName: true, lastName: true } },
    },
  });
  if (!offering) throw new AppError("Class offering not found", 404);
  return offering;
}

function getFinalGrade(scores: GradeValue[]) {
  const score = calculateFinalGrade(scores);
  return { score, descriptor: getGradeDescriptor(score), passing: isPassing(score) };
}

export async function getGradesSheet(classOfferingId: string, user: GradesUser) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const offering = await getOffering(classOfferingId);
  const terms = await prisma.term.findMany({
    where: { schoolYearId: offering.schoolYearId },
    orderBy: { termNumber: "asc" },
    select: { id: true, name: true, termNumber: true, gradesLocked: true },
  });
  const roster = await prisma.student.findMany({
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
    select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
  });
  const grades = await prisma.grade.findMany({
    where: { classOfferingId, termId: { in: terms.map(({ id }) => id) } },
    select: { id: true, studentId: true, termId: true, score: true, remarks: true },
  });
  const byStudentTerm = new Map(grades.map((grade) => [
    `${grade.studentId}:${grade.termId}`,
    { score: numericScore(grade.score), remarks: grade.remarks },
  ]));
  const rosterData = roster.map((student) => {
    const termScores = terms.map((term) => {
      const grade = byStudentTerm.get(`${student.id}:${term.id}`);
      return {
        termId: term.id,
        score: grade?.score ?? null,
        remarks: grade?.remarks ?? null,
      };
    });
    const final = getFinalGrade(termScores.map(({ score }) => score));
    return { ...student, terms: termScores, finalGrade: final.score, descriptor: final.descriptor, passing: final.passing };
  });
  return {
    classOffering: { ...offering },
    terms: terms.map(({ termNumber, ...term }) => ({ ...term, order: termNumber })),
    roster: rosterData,
    editableTermIds: terms
      .filter((term) => user.role === Role.ADMIN || !term.gradesLocked)
      .map(({ id }) => id),
  };
}

export async function saveClassGrades(
  classOfferingId: string,
  user: GradesUser,
  rawInput: unknown,
  request: Request,
) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const parsed = saveGradesSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  }
  const { termId, records } = parsed.data;
  const offering = await getOffering(classOfferingId);
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: { id: true, schoolYearId: true, gradesLocked: true },
  });
  if (!term || term.schoolYearId !== offering.schoolYearId) {
    throw new AppError("The term does not belong to this class school year", 400, "TERM_NOT_IN_SCHOOL_YEAR");
  }
  if (user.role === Role.TEACHER && term.gradesLocked) {
    throw new AppError("This term is locked. Please ask an administrator to make a correction.", 403, "TERM_LOCKED");
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const roster = await transaction.student.findMany({
        where: {
          enrollments: {
            some: {
              sectionId: offering.sectionId,
              schoolYearId: offering.schoolYearId,
              status: EnrollmentStatus.ENROLLED,
            },
          },
        },
        select: { id: true },
      });
      const rosterIds = new Set(roster.map(({ id }) => id));
      const offendingIds = records.map(({ studentId }) => studentId).filter((id) => !rosterIds.has(id));
      if (offendingIds.length) {
        throw new AppError("One or more students are not on this class roster", 400, "STUDENT_NOT_IN_CLASS", {
          studentIds: offendingIds,
        });
      }

      const existing = await transaction.grade.findMany({
        where: { classOfferingId, termId, studentId: { in: records.map(({ studentId }) => studentId) } },
        select: { id: true, studentId: true, score: true, remarks: true },
      });
      const existingByStudent = new Map(existing.map((grade) => [grade.studentId, grade]));
      const counts = { created: 0, updated: 0, cleared: 0, unchanged: 0 };
      const changes: Array<{ entityId: string; studentId: string; oldScore: number | null; newScore: number | null }> = [];

      for (const record of records) {
        const previous = existingByStudent.get(record.studentId);
        const oldScore = previous ? numericScore(previous.score) : null;
        if (record.score === null) {
          if (!previous) {
            counts.unchanged += 1;
            continue;
          }
          await transaction.grade.delete({ where: { id: previous.id } });
          counts.cleared += 1;
          changes.push({ entityId: previous.id, studentId: record.studentId, oldScore, newScore: null });
          continue;
        }
        if (previous && oldScore === record.score && previous.remarks === (record.remarks ?? null)) {
          counts.unchanged += 1;
          continue;
        }
        const saved = await transaction.grade.upsert({
          where: {
            studentId_classOfferingId_termId: {
              studentId: record.studentId,
              classOfferingId,
              termId,
            },
          },
          create: {
            studentId: record.studentId,
            classOfferingId,
            termId,
            score: record.score,
            remarks: record.remarks,
            recordedById: user.id,
          },
          update: { score: record.score, remarks: record.remarks, recordedById: user.id },
          select: { id: true },
        });
        if (previous) counts.updated += 1;
        else counts.created += 1;
        changes.push({
          entityId: saved.id,
          studentId: record.studentId,
          oldScore,
          newScore: record.score,
        });
      }
      return { counts, changes };
    });

    await Promise.all([
      logAudit({
        userId: user.id,
        action: "GRADES_SAVE",
        entity: "ClassOffering",
        entityId: classOfferingId,
        ipAddress: request.ip,
        details: { termId, ...result.counts },
      }),
      ...result.changes.map((change) => logAudit({
        userId: user.id,
        action: "GRADE_CHANGE",
        entity: "Grade",
        entityId: change.entityId,
        ipAddress: request.ip,
        details: {
          studentId: change.studentId,
          termId,
          oldScore: change.oldScore,
          newScore: change.newScore,
        },
      })),
    ]);
    return { termId, ...result.counts };
  } catch (error) {
    handleGradeError(error);
  }
}

async function summarizeTerm(classOfferingId: string, termId: string) {
  const where = { classOfferingId, termId };
  const [aggregate, passing, fairlySatisfactory, satisfactory, verySatisfactory, outstanding, failing] =
    await Promise.all([
      prisma.grade.aggregate({
        where,
        _count: { _all: true },
        _avg: { score: true },
        _max: { score: true },
        _min: { score: true },
      }),
      prisma.grade.count({ where: { ...where, score: { gte: 75, lte: 100 } } }),
      prisma.grade.count({ where: { ...where, score: { gte: 75, lt: 80 } } }),
      prisma.grade.count({ where: { ...where, score: { gte: 80, lt: 85 } } }),
      prisma.grade.count({ where: { ...where, score: { gte: 85, lt: 90 } } }),
      prisma.grade.count({ where: { ...where, score: { gte: 90, lte: 100 } } }),
      prisma.grade.count({ where: { ...where, score: { lt: 75 } } }),
    ]);
  return {
    termId,
    gradedStudents: aggregate._count._all,
    average: numericScore(aggregate._avg.score),
    highest: numericScore(aggregate._max.score),
    lowest: numericScore(aggregate._min.score),
    passingCount: passing,
    failingCount: failing,
    distribution: {
      "90-100": outstanding,
      "85-89": verySatisfactory,
      "80-84": satisfactory,
      "75-79": fairlySatisfactory,
      below75: failing,
    },
  };
}

export async function getClassGradesSummary(classOfferingId: string, user: GradesUser, query: unknown) {
  await assertCanAccessClassOffering(user, classOfferingId);
  const offering = await getOffering(classOfferingId);
  const input = parseQuery(gradeSummaryQuerySchema, query);
  const terms = await prisma.term.findMany({
    where: { schoolYearId: offering.schoolYearId, ...(input.termId ? { id: input.termId } : {}) },
    orderBy: { termNumber: "asc" },
    select: { id: true, name: true, termNumber: true },
  });
  if (input.termId && !terms.length) throw new AppError("Term not found for this class school year", 400, "TERM_NOT_IN_SCHOOL_YEAR");
  return {
    classOfferingId,
    summaries: await Promise.all(terms.map(async (term) => ({
      term: { id: term.id, name: term.name, order: term.termNumber },
      ...(await summarizeTerm(classOfferingId, term.id)),
    }))),
  };
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

async function getStudentGradeData(studentId: string, schoolYearId: string, showUnlocked: boolean) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, schoolYearId, status: EnrollmentStatus.ENROLLED, sectionId: { not: null } },
    select: {
      section: { select: { id: true, name: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true } },
    },
  });
  const terms = await prisma.term.findMany({
    where: { schoolYearId },
    orderBy: { termNumber: "asc" },
    select: { id: true, name: true, termNumber: true, gradesLocked: true },
  });
  if (!enrollment?.section) {
    return {
      schoolYearId,
      enrollment: null,
      subjects: [],
      generalAverage: null,
    };
  }

  const offerings = await prisma.classOffering.findMany({
    where: { sectionId: enrollment.section.id, schoolYearId },
    orderBy: { subject: { name: "asc" } },
    select: {
      id: true,
      subject: { select: { id: true, code: true, name: true } },
    },
  });
  const grades = await prisma.grade.findMany({
    where: {
      studentId,
      classOfferingId: { in: offerings.map(({ id }) => id) },
      termId: { in: terms.map(({ id }) => id) },
    },
    select: { classOfferingId: true, termId: true, score: true },
  });
  const byOfferingTerm = new Map(grades.map((grade) => [
    `${grade.classOfferingId}:${grade.termId}`,
    numericScore(grade.score),
  ]));
  const subjects = offerings.map((offering) => {
    const quarterlyScores = terms.map((term) => {
      const score = byOfferingTerm.get(`${offering.id}:${term.id}`) ?? null;
      return {
        termId: term.id,
        name: term.name,
        order: term.termNumber,
        locked: term.gradesLocked,
        score: showUnlocked || term.gradesLocked ? score : null,
      };
    });
    const releasedFinalGrades = quarterlyScores.map((term) => term.score);
    const allLocked = terms.length === 4 && quarterlyScores.length === 4 && quarterlyScores.every((term) => term.locked);
    const finalGrade = allLocked ? getFinalGrade(releasedFinalGrades) : { score: null, descriptor: null, passing: null };
    return {
      classOfferingId: offering.id,
      subject: offering.subject,
      terms: quarterlyScores,
      finalGrade: finalGrade.score,
      descriptor: finalGrade.descriptor,
      passing: finalGrade.passing,
    };
  });
  return {
    schoolYearId,
    enrollment: {
      section: enrollment.section,
      schoolYear: enrollment.schoolYear,
    },
    subjects,
    generalAverage: calculateGeneralAverage(subjects.map(({ finalGrade }) => finalGrade)),
  };
}

export async function getMyGrades(userId: string, query: unknown) {
  const input = parseQuery(schoolYearQuerySchema, query);
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (!student) throw new AppError("Student profile not found", 404, "STUDENT_PROFILE_NOT_FOUND");
  const schoolYearId = await resolveSchoolYearId(input.schoolYearId);
  return getStudentGradeData(student.id, schoolYearId, false);
}

export async function getStudentGrades(studentId: string, query: unknown) {
  const input = parseQuery(schoolYearQuerySchema, query);
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new AppError("Student not found", 404);
  const schoolYearId = await resolveSchoolYearId(input.schoolYearId);
  const data = await getStudentGradeData(student.id, schoolYearId, true);
  return {
    ...data,
    subjects: data.subjects.map((subject) => ({
      ...subject,
      lockedStatus: subject.terms.map(({ termId, locked }) => ({ termId, locked })),
    })),
  };
}

async function getCompleteness(schoolYearId: string, termId: string) {
  const offerings = await prisma.classOffering.findMany({
    where: { schoolYearId },
    orderBy: [{ section: { gradeLevel: "asc" } }, { section: { name: "asc" } }, { subject: { name: "asc" } }],
    select: {
      id: true,
      sectionId: true,
      section: {
        select: {
          name: true,
          gradeLevel: true,
          enrollments: {
            where: { schoolYearId, status: EnrollmentStatus.ENROLLED },
            select: { studentId: true },
          },
        },
      },
      subject: { select: { code: true, name: true } },
      teacher: { select: { firstName: true, middleName: true, lastName: true } },
    },
  });
  const grades = await prisma.grade.findMany({
    where: { termId, classOfferingId: { in: offerings.map(({ id }) => id) } },
    select: { classOfferingId: true, studentId: true },
  });
  const gradedByOffering = new Map<string, Set<string>>();
  for (const grade of grades) {
    const set = gradedByOffering.get(grade.classOfferingId) ?? new Set<string>();
    set.add(grade.studentId);
    gradedByOffering.set(grade.classOfferingId, set);
  }
  const classes = offerings.map((offering) => {
    const enrolledIds = new Set(offering.section.enrollments.map(({ studentId }) => studentId));
    const gradedIds = gradedByOffering.get(offering.id) ?? new Set<string>();
    const gradedCount = [...gradedIds].filter((id) => enrolledIds.has(id)).length;
    return {
      classOfferingId: offering.id,
      section: { name: offering.section.name, gradeLevel: offering.section.gradeLevel },
      subject: offering.subject,
      teacher: offering.teacher,
      enrolledCount: enrolledIds.size,
      gradedCount,
      missingCount: Math.max(enrolledIds.size - gradedCount, 0),
    };
  });
  return {
    offeringsWithMissingGrades: classes.filter((item) => item.missingCount > 0).length,
    missingGradeCount: classes.reduce((sum, item) => sum + item.missingCount, 0),
    classes,
  };
}

export async function lockSchoolYearTerm(
  schoolYearId: string,
  termId: string,
  user: GradesUser,
  rawInput: unknown,
  request: Request,
) {
  const parsed = termLockSchema.safeParse(rawInput);
  if (!parsed.success) throw new AppError("Validation failed", 400, undefined, { errors: parsed.error.flatten() });
  const { locked, reason } = parsed.data;
  const term = await prisma.term.findFirst({
    where: { id: termId, schoolYearId },
    select: { id: true, name: true, schoolYearId: true, termNumber: true, gradesLocked: true },
  });
  if (!term) throw new AppError("Term not found for this school year", 404);

  const changed = term.gradesLocked !== locked;
  const updated = changed
    ? await prisma.term.update({
      where: { id: termId },
      data: locked
        ? { gradesLocked: true, lockedAt: new Date(), lockedById: user.id }
        : { gradesLocked: false, lockedAt: null, lockedById: null },
      select: {
        id: true,
        name: true,
        schoolYearId: true,
        termNumber: true,
        gradesLocked: true,
        lockedAt: true,
        lockedById: true,
      },
    })
    : await prisma.term.findUniqueOrThrow({
      where: { id: termId },
      select: {
        id: true,
        name: true,
        schoolYearId: true,
        termNumber: true,
        gradesLocked: true,
        lockedAt: true,
        lockedById: true,
      },
    });
  if (changed) {
    await logAudit({
      userId: user.id,
      action: locked ? "TERM_LOCK" : "TERM_UNLOCK",
      entity: "Term",
      entityId: termId,
      ipAddress: request.ip,
      details: { reason: reason ?? null, schoolYearId },
    });
  }
  const completeness = locked ? await getCompleteness(schoolYearId, termId) : null;
  return {
    term: { ...updated, order: updated.termNumber },
    completeness,
  };
}

export async function getTermGradeCompleteness(schoolYearId: string, termId: string) {
  const term = await prisma.term.findFirst({ where: { id: termId, schoolYearId }, select: { id: true } });
  if (!term) throw new AppError("Term not found for this school year", 404);
  return { termId, ...(await getCompleteness(schoolYearId, termId)) };
}

export async function getSectionGradeOverview(
  sectionId: string,
  user: GradesUser,
  query: unknown,
) {
  const { termId } = parseQuery(gradeOverviewQuerySchema, query);
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      schoolYearId: true,
      adviserId: true,
    },
  });
  if (!section) throw new AppError("Section not found", 404);
  if (user.role === Role.TEACHER) {
    const teacherId = await getTeacherIdForUser(user.id);
    if (teacherId !== section.adviserId) throw new AppError("Forbidden", 403, "FORBIDDEN");
  } else if (user.role !== Role.ADMIN) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  const term = await prisma.term.findFirst({
    where: { id: termId, schoolYearId: section.schoolYearId },
    select: { id: true, name: true, termNumber: true, gradesLocked: true },
  });
  if (!term) throw new AppError("Term not found for this section school year", 400, "TERM_NOT_IN_SCHOOL_YEAR");

  const [roster, offerings] = await Promise.all([
    prisma.student.findMany({
      where: {
        enrollments: {
          some: {
            sectionId,
            schoolYearId: section.schoolYearId,
            status: EnrollmentStatus.ENROLLED,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: { id: true, studentNo: true, firstName: true, middleName: true, lastName: true },
    }),
    prisma.classOffering.findMany({
      where: { sectionId, schoolYearId: section.schoolYearId },
      orderBy: { subject: { name: "asc" } },
      select: {
        id: true,
        subject: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);
  const grades = await prisma.grade.findMany({
    where: {
      termId,
      classOfferingId: { in: offerings.map(({ id }) => id) },
      studentId: { in: roster.map(({ id }) => id) },
    },
    select: { studentId: true, classOfferingId: true, score: true },
  });
  const gradeMap = new Map(grades.map((grade) => [
    `${grade.studentId}:${grade.classOfferingId}`,
    numericScore(grade.score),
  ]));
  return {
    section: { id: section.id, name: section.name, gradeLevel: section.gradeLevel },
    term: { id: term.id, name: term.name, order: term.termNumber, gradesLocked: term.gradesLocked },
    subjects: offerings.map((offering) => ({ classOfferingId: offering.id, subject: offering.subject })),
    students: roster.map((student) => ({
      ...student,
      scores: offerings.map((offering) => ({
        classOfferingId: offering.id,
        subjectId: offering.subject.id,
        score: gradeMap.get(`${student.id}:${offering.id}`) ?? null,
      })),
    })),
  };
}
