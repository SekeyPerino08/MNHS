import { createHash, randomUUID } from "node:crypto";
import {
  EnrollmentStatus,
  ImportStatus,
  ImportType,
  Prisma,
  type ImportJob,
} from "@prisma/client";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../services/audit.service.js";
import { AppError } from "../../utils/AppError.js";
import { buildPaginationMeta, parsePagination } from "../../utils/pagination.js";
import { csvTemplate, rejectedRowsCsv } from "./etl/report.js";
import { mapHeaders } from "./etl/mapHeaders.js";
import { parseCsv } from "./etl/parse.js";
import { transformRows } from "./etl/transform.js";
import {
  addIssue,
  addPossibleDuplicateWarnings,
  finalizeRows,
  summarizeRows,
  validateExistingNumbers,
  validateInFileDuplicates,
} from "./etl/validate.js";
import {
  commitImportSchema,
  importHistoryQuerySchema,
  importRowsQuerySchema,
  importTypeSchema,
  previewOptionsSchema,
} from "./import.schema.js";
import type { ImportOptions, ImportPreviewRow, TransformedRow } from "./import.types.js";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const PREVIEW_LIFETIME_MS = 24 * 60 * 60 * 1000;

function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
}

function actorId(request: Request): string {
  if (!request.user) throw new AppError("Not authenticated", 401, "NOT_AUTHENTICATED");
  return request.user.id;
}

function sanitizeFileName(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? "";
  const clean = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(0, 120);
  return clean || "upload.csv";
}

function validateUpload(file: Express.Multer.File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError("CSV files must be 2 MB or smaller", 413, "FILE_TOO_LARGE");
  }
  if (!/\.csv$/i.test(file.originalname)) {
    throw new AppError("Upload a file with a .csv extension", 400, "INVALID_FILE_TYPE");
  }
  const acceptedMimeTypes = new Set([
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
  ]);
  if (!acceptedMimeTypes.has(file.mimetype.toLocaleLowerCase())) {
    throw new AppError("Upload a CSV text file", 400, "INVALID_FILE_TYPE");
  }
}

function json(value: object): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function summary(job: ImportJob) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    fileName: job.fileName,
    options: job.options,
    totals: job.totals,
    expiresAt: job.expiresAt,
    createdById: job.createdById,
    committedAt: job.committedAt,
    result: job.result,
    createdAt: job.createdAt,
  };
}

async function loadJob(id: string): Promise<ImportJob> {
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) throw new AppError("Import job not found", 404, "IMPORT_NOT_FOUND");
  return job;
}

async function expireIfNeeded(job: ImportJob): Promise<ImportJob> {
  if (job.status !== ImportStatus.PREVIEWED || job.expiresAt.getTime() > Date.now()) return job;
  return prisma.importJob.update({
    where: { id: job.id },
    data: { status: ImportStatus.EXPIRED, rows: Prisma.DbNull },
  });
}

function storedRows(job: ImportJob): ImportPreviewRow[] {
  if (!Array.isArray(job.rows)) {
    throw new AppError("This import preview has expired or its rows were purged", 410, "IMPORT_EXPIRED");
  }
  return job.rows as unknown as ImportPreviewRow[];
}

function databasePersonKey(
  type: ImportType,
  person: { firstName: string; lastName: string; birthDate?: Date | null },
): string {
  const base = `${person.firstName.toLocaleLowerCase()}|${person.lastName.toLocaleLowerCase()}`;
  return type === ImportType.STUDENTS
    ? `${base}|${person.birthDate?.toISOString().slice(0, 10) ?? ""}`
    : base;
}

async function validateDatabaseDuplicates(
  type: ImportType,
  rows: TransformedRow[],
): Promise<void> {
  const numberField = type === ImportType.STUDENTS ? "studentNo" : "employeeNo";
  const numbers = [...new Set(rows.flatMap((row) => {
    const value = row.pending[numberField];
    return typeof value === "string" && value ? [value] : [];
  }))];

  if (type === ImportType.STUDENTS) {
    const [existingNumbers, people] = await Promise.all([
      numbers.length
        ? prisma.student.findMany({
            where: { studentNo: { in: numbers } },
            select: { studentNo: true },
          })
        : [],
      prisma.student.findMany({
        where: {
          OR: rows.flatMap((row) => {
            const firstName = row.pending.firstName;
            const lastName = row.pending.lastName;
            const birthDate = row.pending.birthDate;
            if (
              row.status === "ERROR" ||
              typeof firstName !== "string" ||
              typeof lastName !== "string" ||
              typeof birthDate !== "string"
            ) return [];
            const date = new Date(`${birthDate}T00:00:00.000Z`);
            return [{
              firstName: { equals: firstName, mode: "insensitive" as const },
              lastName: { equals: lastName, mode: "insensitive" as const },
              birthDate: { gte: date, lt: new Date(date.getTime() + 86_400_000) },
            }];
          }),
        },
        select: { studentNo: true, firstName: true, lastName: true, birthDate: true },
      }),
    ]);
    validateExistingNumbers(
      rows,
      type,
      new Set(existingNumbers.map(({ studentNo }) => studentNo.toLocaleLowerCase())),
    );
    const byPerson = new Map<string, string[]>();
    for (const person of people) {
      const key = databasePersonKey(ImportType.STUDENTS, person);
      byPerson.set(key, [...(byPerson.get(key) ?? []), person.studentNo]);
    }
    addPossibleDuplicateWarnings(rows, type, byPerson);
    return;
  }

  const [existingNumbers, people] = await Promise.all([
    numbers.length
      ? prisma.teacher.findMany({
          where: { employeeNo: { in: numbers } },
          select: { employeeNo: true },
        })
      : [],
    prisma.teacher.findMany({
      where: {
        OR: rows.flatMap((row) => {
          const firstName = row.pending.firstName;
          const lastName = row.pending.lastName;
          if (
            row.status === "ERROR" ||
            typeof firstName !== "string" ||
            typeof lastName !== "string"
          ) return [];
          return [
            {
              firstName: { equals: firstName, mode: "insensitive" as const },
              lastName: { equals: lastName, mode: "insensitive" as const },
            },
          ];
        }),
      },
      select: { employeeNo: true, firstName: true, lastName: true },
    }),
  ]);
  validateExistingNumbers(
    rows,
    type,
    new Set(existingNumbers.map(({ employeeNo }) => employeeNo.toLocaleLowerCase())),
  );
  const byPerson = new Map<string, string[]>();
  for (const person of people) {
    const key = databasePersonKey(ImportType.TEACHERS, person);
    byPerson.set(key, [...(byPerson.get(key) ?? []), person.employeeNo]);
  }
  addPossibleDuplicateWarnings(rows, type, byPerson);
}

async function resolveStudentEnrollments(
  rows: TransformedRow[],
  mapping: ReturnType<typeof mapHeaders>,
): Promise<void> {
  if (!mapping.hasGradeLevel || !mapping.hasSection) return;
  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
  if (!currentYear) {
    throw new AppError("Set a current school year before previewing student enrollments", 400, "NO_CURRENT_SCHOOL_YEAR");
  }
  const requested = rows.flatMap((row) => {
    const gradeLevel = row.pending.gradeLevel;
    const sectionName = row.pending.section;
    if (typeof gradeLevel !== "number" || typeof sectionName !== "string" || !sectionName) return [];
    return [{ gradeLevel, sectionName }];
  });
  const sections = requested.length
    ? await prisma.section.findMany({
        where: {
          schoolYearId: currentYear.id,
          OR: requested.map(({ gradeLevel, sectionName }) => ({
            gradeLevel,
            name: { equals: sectionName, mode: "insensitive" as const },
          })),
        },
        select: { id: true, name: true, gradeLevel: true },
      })
    : [];
  const sectionMap = new Map(
    sections.map((section) => [`${section.gradeLevel}|${section.name.toLocaleLowerCase()}`, section]),
  );

  for (const row of rows) {
    if (row.status === "ERROR") continue;
    const grade = row.pending.gradeLevel;
    const sectionName = row.pending.section;
    if ((grade === null || grade === undefined) && !sectionName) continue;
    if (typeof grade !== "number" || typeof sectionName !== "string" || !sectionName) {
      addIssue(row, {
        field: "section",
        message: "Grade Level and Section must both be provided for enrollment",
      });
      continue;
    }
    const section = sectionMap.get(`${grade}|${sectionName.toLocaleLowerCase()}`);
    if (!section) {
      addIssue(row, {
        field: "section",
        message: `Section '${sectionName}' not found for Grade ${grade} in ${currentYear.name}`,
      });
      continue;
    }
    row.enrollment = { sectionId: section.id, label: `Grade ${grade} - ${section.name}` };
    row.normalized = { ...row.pending };
  }
}

export function getImportTemplate(rawType: unknown): { type: ImportType; content: string } {
  const type = parseInput(importTypeSchema, rawType);
  return { type, content: csvTemplate(type) };
}

export async function previewImport(
  file: Express.Multer.File,
  rawOptions: unknown,
  request: Request,
) {
  const creatorId = actorId(request);
  validateUpload(file);
  const options = parseInput(previewOptionsSchema, rawOptions) as { type: ImportType; dateFormat: ImportOptions["dateFormat"] };
  const parsed = parseCsv(file.buffer);
  const mapping = mapHeaders(parsed.headers, options.type);
  const transformed = transformRows(parsed, mapping, options.type, options);
  validateInFileDuplicates(transformed, options.type);
  await validateDatabaseDuplicates(options.type, transformed);
  if (options.type === ImportType.STUDENTS && (mapping.hasGradeLevel || mapping.hasSection)) {
    if (!mapping.hasGradeLevel || !mapping.hasSection) {
      for (const row of transformed) {
        if (row.status !== "ERROR") {
          addIssue(row, {
            field: mapping.hasGradeLevel ? "section" : "gradeLevel",
            message: "Grade Level and Section columns must both be provided for enrollment",
          });
        }
      }
    } else {
      await resolveStudentEnrollments(transformed, mapping);
    }
  }
  const rows = finalizeRows(transformed);
  const totals = summarizeRows(rows);
  const hash = createHash("sha256").update(file.buffer).digest("hex");
  const storedOptions = {
    dateFormat: options.dateFormat,
    recognizedColumns: mapping.recognized,
    ignoredColumns: mapping.ignored,
    originalHeaders: parsed.headers,
    delimiter: parsed.delimiter,
  };
  const created = await prisma.$transaction(async (transaction) => {
    const job = await transaction.importJob.create({
      data: {
        type: options.type,
        status: ImportStatus.PREVIEWED,
        fileName: sanitizeFileName(file.originalname),
        fileHash: hash,
        options: json(storedOptions),
        totals: json(totals),
        rows: rows as unknown as Prisma.InputJsonArray,
        expiresAt: new Date(Date.now() + PREVIEW_LIFETIME_MS),
        createdById: creatorId,
      },
    });
    await logAudit({
      userId: creatorId,
      action: "IMPORT_PREVIEW",
      entity: "ImportJob",
      entityId: job.id,
      details: json({ type: options.type, ...totals }),
      ipAddress: request.ip,
    }, transaction);
    return job;
  });
  return { ...summary(created), rows };
}

export async function getImportTemplateResponse(rawType: unknown) {
  return getImportTemplate(rawType);
}

export async function getImportJob(id: string) {
  return summary(await expireIfNeeded(await loadJob(id)));
}

export async function getImportRows(id: string, rawQuery: unknown) {
  const query = parseInput(importRowsQuerySchema, rawQuery);
  const job = await expireIfNeeded(await loadJob(id));
  const rows = storedRows(job);
  const filtered = query.status === "ALL" ? rows : rows.filter((row) => row.status === query.status);
  const { skip, take } = parsePagination(query);
  return {
    data: filtered.slice(skip, skip + take),
    meta: buildPaginationMeta(query.page, query.pageSize, filtered.length),
  };
}

export async function getRejectedCsv(id: string) {
  const job = await expireIfNeeded(await loadJob(id));
  if (job.status !== ImportStatus.PREVIEWED) {
    throw new AppError("Download rejected rows before importing; rejected CSV is only available for previews", 410, "IMPORT_EXPIRED");
  }
  const rows = storedRows(job);
  const options = job.options as { originalHeaders?: string[] };
  return {
    fileName: `${job.fileName.replace(/\.csv$/i, "")}-rejected.csv`,
    content: rejectedRowsCsv(rows, options.originalHeaders ?? []),
  };
}

function normalizedString(row: ImportPreviewRow, field: string): string | null {
  const value = row.normalized?.[field];
  return typeof value === "string" ? value : null;
}

function normalizedNullable(row: ImportPreviewRow, field: string): string | null {
  const value = row.normalized?.[field];
  return typeof value === "string" && value ? value : null;
}

function normalizedNumber(row: ImportPreviewRow, field: string): number | null {
  const value = row.normalized?.[field];
  return typeof value === "number" ? value : null;
}

export async function commitImport(id: string, rawBody: unknown, request: Request) {
  const creatorId = actorId(request);
  const { includeWarnings } = parseInput(commitImportSchema, rawBody);
  const job = await expireIfNeeded(await loadJob(id));
  if (job.createdById !== creatorId) {
    throw new AppError("Only the administrator who created this preview can commit it", 403, "IMPORT_OWNER_REQUIRED");
  }
  if (job.status === ImportStatus.EXPIRED || job.expiresAt.getTime() <= Date.now()) {
    throw new AppError("This import preview has expired", 410, "IMPORT_EXPIRED");
  }
  if (job.status !== ImportStatus.PREVIEWED) {
    throw new AppError("This import job has already been committed or discarded", 409, "ALREADY_COMMITTED");
  }

  const rows = storedRows(job);
  const selected = rows.filter((row) =>
    row.status === "VALID" || (includeWarnings && row.status === "WARNING"),
  );
  const skippedWarnings = rows.filter((row) => row.status === "WARNING" && !includeWarnings).length;
  const skippedErrors = rows.filter((row) => row.status === "ERROR").length;
  if (!selected.length) throw new AppError("There are no valid rows to import", 400, "NO_VALID_ROWS");

  const result = {
    created: selected.length,
    enrolled: selected.filter((row) => row.enrollment).length,
    skippedWarnings,
    skippedErrors,
  };
  const ids = new Map(selected.map((row) => [row.rowNumber, randomUUID()]));

  try {
    return await prisma.$transaction(async (transaction) => {
      const claim = await transaction.importJob.updateMany({
        where: {
          id,
          createdById: creatorId,
          status: ImportStatus.PREVIEWED,
          expiresAt: { gt: new Date() },
        },
        data: { status: ImportStatus.COMMITTED },
      });
      if (claim.count !== 1) {
        throw new AppError("This import job is no longer available to commit", 409, "ALREADY_COMMITTED");
      }

      if (job.type === ImportType.STUDENTS) {
        const studentRows = selected.map((row) => ({
          id: ids.get(row.rowNumber)!,
          row,
        }));
        await transaction.student.createMany({
          data: studentRows.map(({ id: studentId, row }) => ({
            id: studentId,
            studentNo: normalizedString(row, "studentNo")!,
            firstName: normalizedString(row, "firstName")!,
            middleName: normalizedNullable(row, "middleName"),
            lastName: normalizedString(row, "lastName")!,
            sex: normalizedString(row, "sex") as "MALE" | "FEMALE",
            birthDate: new Date(`${normalizedString(row, "birthDate")}T00:00:00.000Z`),
            address: normalizedNullable(row, "address"),
            guardianName: normalizedNullable(row, "guardianName"),
            guardianContact: normalizedNullable(row, "guardianContact"),
          })),
        });

        const sectionIds = [...new Set(selected.flatMap((row) => row.enrollment ? [row.enrollment.sectionId] : []))];
        const sections = sectionIds.length
          ? await transaction.section.findMany({
              where: { id: { in: sectionIds } },
              select: { id: true, schoolYearId: true },
            })
          : [];
        const schoolYearBySection = new Map(sections.map((section) => [section.id, section.schoolYearId]));
        const enrollmentData = selected.flatMap((row) => {
          if (!row.enrollment) return [];
          const schoolYearId = schoolYearBySection.get(row.enrollment.sectionId);
          if (!schoolYearId) {
            throw new AppError("A selected section is no longer available; re-run the preview", 409, "IMPORT_CONFLICT");
          }
          return [{
            id: randomUUID(),
            studentId: ids.get(row.rowNumber)!,
            sectionId: row.enrollment.sectionId,
            schoolYearId,
            status: EnrollmentStatus.ENROLLED,
          }];
        });
        if (enrollmentData.length) await transaction.enrollment.createMany({ data: enrollmentData });
      } else {
        await transaction.teacher.createMany({
          data: selected.map((row) => ({
            id: ids.get(row.rowNumber)!,
            employeeNo: normalizedString(row, "employeeNo")!,
            firstName: normalizedString(row, "firstName")!,
            middleName: normalizedNullable(row, "middleName"),
            lastName: normalizedString(row, "lastName")!,
            department: normalizedNullable(row, "department"),
            contactNo: normalizedNullable(row, "contactNo"),
          })),
        });
      }

      await logAudit({
        userId: creatorId,
        action: "IMPORT_COMMIT",
        entity: "ImportJob",
        entityId: id,
        details: json({ ...result, fileHash: job.fileHash, type: job.type }),
        ipAddress: request.ip,
      }, transaction);
      const updated = await transaction.importJob.update({
        where: { id },
        data: {
          status: ImportStatus.COMMITTED,
          committedAt: new Date(),
          result: json(result),
          rows: Prisma.DbNull,
        },
      });
      return { ...summary(updated), result };
    }, { timeout: 30_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError(
          "An imported number was added after preview. Re-run the preview; no rows were imported.",
          409,
          "IMPORT_CONFLICT",
        );
      }
      if (error.code === "P2025") throw new AppError("Import job not found", 404, "IMPORT_NOT_FOUND");
      if (error.code === "P2003") {
        throw new AppError("A referenced section or school year changed. Re-run the preview.", 409, "IMPORT_CONFLICT");
      }
    }
    throw error;
  }
}

export async function discardImport(id: string, request: Request) {
  const creatorId = actorId(request);
  const job = await expireIfNeeded(await loadJob(id));
  if (job.createdById !== creatorId) {
    throw new AppError("Only the administrator who created this preview can discard it", 403, "IMPORT_OWNER_REQUIRED");
  }
  if (job.status !== ImportStatus.PREVIEWED) {
    throw new AppError("Only a previewed import can be discarded", 409, "IMPORT_NOT_PREVIEWED");
  }
  return prisma.$transaction(async (transaction) => {
    const changed = await transaction.importJob.updateMany({
      where: {
        id,
        createdById: creatorId,
        status: ImportStatus.PREVIEWED,
        expiresAt: { gt: new Date() },
      },
      data: { status: ImportStatus.DISCARDED, rows: Prisma.DbNull },
    });
    if (changed.count !== 1) {
      throw new AppError("Only a previewed import can be discarded", 409, "IMPORT_NOT_PREVIEWED");
    }
    await logAudit({
      userId: creatorId,
      action: "IMPORT_DISCARD",
      entity: "ImportJob",
      entityId: id,
      details: json({ type: job.type, totals: job.totals }),
      ipAddress: request.ip,
    }, transaction);
    return summary(await transaction.importJob.findUniqueOrThrow({ where: { id } }));
  });
}

export async function listImportJobs(rawQuery: unknown) {
  const query = parseInput(importHistoryQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  await prisma.importJob.updateMany({
    where: { status: ImportStatus.PREVIEWED, expiresAt: { lte: new Date() } },
    data: { status: ImportStatus.EXPIRED, rows: Prisma.DbNull },
  });
  const where: Prisma.ImportJobWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [jobs, total] = await Promise.all([
    prisma.importJob.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        fileName: true,
        status: true,
        totals: true,
        result: true,
        createdBy: { select: { email: true } },
        createdAt: true,
        committedAt: true,
      },
    }),
    prisma.importJob.count({ where }),
  ]);
  return {
    data: jobs.map(({ createdBy, ...job }) => ({
      ...job,
      createdByEmail: createdBy?.email ?? null,
    })),
    meta: buildPaginationMeta(query.page, query.pageSize, total),
  };
}
