import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import {
  type CreateSchoolYearInput,
  type UpdateSchoolYearInput,
  type UpdateTermInput,
} from "./school-year.schema.js";

const schoolYearWithTerms = {
  terms: { orderBy: { termNumber: "asc" as const } },
};

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function handleSchoolYearError(error: unknown): never {
  if (isKnownError(error, "P2025")) throw new AppError("School year or term not found", 404);
  if (isKnownError(error, "P2002")) throw new AppError("A school year with this name already exists", 409, "SCHOOL_YEAR_EXISTS");
  throw error;
}

function dateAtUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildTerms(startInput: Date, endInput: Date) {
  const start = dateAtUtcMidnight(startInput);
  const end = dateAtUtcMidnight(endInput);
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  if (totalDays < 4) {
    throw new AppError("The date range must be at least four days to create four terms", 400);
  }
  return ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"].map((name, index) => {
    const firstDayOffset = Math.floor((totalDays * index) / 4);
    const lastDayOffset = Math.floor((totalDays * (index + 1)) / 4) - 1;
    return {
      name,
      termNumber: index + 1,
      startDate: new Date(start.getTime() + firstDayOffset * dayMs),
      endDate: new Date(start.getTime() + lastDayOffset * dayMs),
    };
  });
}

export async function listSchoolYears() {
  return prisma.schoolYear.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: schoolYearWithTerms,
  });
}

export async function getCurrentSchoolYear() {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    include: schoolYearWithTerms,
  });
  if (!schoolYear) throw new AppError("No current school year is configured", 404, "NO_CURRENT_SCHOOL_YEAR");
  return schoolYear;
}

export async function createSchoolYear(input: CreateSchoolYearInput, request?: Request) {
  try {
    const terms = buildTerms(input.startDate, input.endDate);
    const schoolYear = await prisma.$transaction((transaction) =>
      transaction.schoolYear.create({
        data: { ...input, terms: { create: terms } },
        include: schoolYearWithTerms,
      }),
    );
    await logAudit({
      userId: request?.user?.id,
      action: "CREATE",
      entity: "SchoolYear",
      entityId: schoolYear.id,
      details: { name: schoolYear.name, startDate: schoolYear.startDate.toISOString(), endDate: schoolYear.endDate.toISOString() },
      ipAddress: request?.ip,
    });
    return schoolYear;
  } catch (error) {
    handleSchoolYearError(error);
  }
}

export async function updateSchoolYear(id: string, input: UpdateSchoolYearInput, request?: Request) {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const before = await transaction.schoolYear.findUnique({
        where: { id },
        include: { terms: { select: { startDate: true, endDate: true } } },
      });
      if (!before) throw new AppError("School year not found", 404);
      const startDate = input.startDate ?? before.startDate;
      const endDate = input.endDate ?? before.endDate;
      if (endDate <= startDate) throw new AppError("End date must be after start date", 400);
      if (before.terms.some((term) => term.startDate < startDate || term.endDate > endDate)) {
        throw new AppError("School year dates cannot exclude an existing term", 409, "TERMS_OUTSIDE_SCHOOL_YEAR");
      }
      const updated = await transaction.schoolYear.update({ where: { id }, data: input, include: schoolYearWithTerms });
      const changes = Object.fromEntries(
        Object.entries(input)
          .filter(([key, value]) => {
            const previous = before[key as keyof typeof before];
            return previous instanceof Date && value instanceof Date
              ? previous.getTime() !== value.getTime()
              : previous !== value;
          })
          .map(([key, value]) => {
            const previous = before[key as keyof typeof before];
            return [
              key,
              {
                before: previous instanceof Date ? previous.toISOString() : previous,
                after: value instanceof Date ? value.toISOString() : value,
              },
            ];
          }),
      ) as Prisma.InputJsonObject;
      return { updated, changes };
    });
    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "SchoolYear",
      entityId: id,
      details: result.changes,
      ipAddress: request?.ip,
    });
    return result.updated;
  } catch (error) {
    handleSchoolYearError(error);
  }
}

export async function setCurrentSchoolYear(id: string, request?: Request) {
  try {
    const schoolYear = await prisma.$transaction(async (transaction) => {
      const exists = await transaction.schoolYear.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new AppError("School year not found", 404);
      await transaction.schoolYear.updateMany({ where: { id: { not: id } }, data: { isCurrent: false } });
      return transaction.schoolYear.update({ where: { id }, data: { isCurrent: true }, include: schoolYearWithTerms });
    });
    await logAudit({
      userId: request?.user?.id,
      action: "SET_CURRENT",
      entity: "SchoolYear",
      entityId: id,
      details: { isCurrent: true },
      ipAddress: request?.ip,
    });
    return schoolYear;
  } catch (error) {
    handleSchoolYearError(error);
  }
}

export async function updateSchoolYearTerm(
  schoolYearId: string,
  termId: string,
  input: UpdateTermInput,
  request?: Request,
) {
  try {
    const term = await prisma.$transaction(async (transaction) => {
      const year = await transaction.schoolYear.findUnique({
        where: { id: schoolYearId },
        select: { id: true, startDate: true, endDate: true },
      });
      if (!year) throw new AppError("School year not found", 404);
      const existingTerm = await transaction.term.findFirst({
        where: { id: termId, schoolYearId },
        select: { id: true },
      });
      if (!existingTerm) throw new AppError("Term not found in this school year", 404);
      if (input.startDate < year.startDate || input.endDate > year.endDate) {
        throw new AppError("Term dates must fall inside the school year", 400);
      }
      const overlap = await transaction.term.findFirst({
        where: {
          schoolYearId,
          id: { not: termId },
          startDate: { lte: input.endDate },
          endDate: { gte: input.startDate },
        },
        select: { name: true },
      });
      if (overlap) throw new AppError(`Term dates overlap ${overlap.name}`, 409, "TERM_OVERLAP");
      return transaction.term.update({ where: { id: termId }, data: input });
    });
    await logAudit({
      userId: request?.user?.id,
      action: "UPDATE",
      entity: "Term",
      entityId: termId,
      details: { schoolYearId, ...input } as Prisma.InputJsonObject,
      ipAddress: request?.ip,
    });
    return term;
  } catch (error) {
    handleSchoolYearError(error);
  }
}
