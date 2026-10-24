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
import { csvTemplate, rejectedRowsCsv } from "./report.js";
import { mapHeaders } from "./map-headers.js";
import { parseCsv } from "./parse.js";
import { transformRows } from "./transform.js";
import {
  addPossibleDuplicateWarnings,
  printableRow,
  summarizeRows,
  validateUniqueNumbers,
} from "./validate.js";
import {
  commitImportSchema,
  importHistoryQuerySchema,
  importRowsQuerySchema,
  importTypeSchema,
  previewOptionsSchema,
} from "./import.schema.js";
import type { CommitStudentData, ImportOptions, ImportPreviewRow } from "./import.types.js";
import type { ImportType as ImportTypeValue } from "@prisma/client";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const PREVIEW_LIFETIME_MS = 24 * 60 * 60 * 1000;

function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown, label = "Validation failed"): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(label, 400, "VALIDATION_ERROR", {
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  return parsed.data;
}

function sanitizeFileName(name: string): string {
  const baseName = name.split(/[\\/]/).pop() ?? "";
  const clean = baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .slice(0, 120);
  return clean || "upload.csv";
}

function storedRows(job: Pick<ImportJob, "previewRows">): ImportPreviewRow[] {
  if (!Array.isArray(job.previewRows)) {
    throw new AppError("Import preview data is unavailable", 500, "IMPORT_DATA_UNAVAILABLE");
  }
  return job.previewRows as unknown as ImportPreviewRow[];
}

function auditDetails(value: Record<string, string | number | boolean>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function requestUserId(request: Request): string {
  if (!request.user) throw new AppError("Not authenticated", 401, "NOT_AUTHENTICATED");
  return request.user.id;
}

async function expireJob(job: ImportJob): Promise<ImportJob> {
  if (job.status !== ImportStatus.PREVIEWED || job.expiresAt.getTime() > Date.now()) return job;
  return prisma.importJob.update({
    where: { id: job.id },
    data: { status: ImportStatus.EXPIRED, previewRows: [] },
  });
}

async function getJob(id: string): Promise<ImportJob> {
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) throw new AppError("Import job not found", 404, "IMPORT_NOT_FOUND");
  return expireJob(job);
}

function summary(job: ImportJob) {
  const { previewRows: _previewRows, fileHash: _fileHash, ...metadata } = job;
  return metadata;
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

async function checkNumbers(type: ImportTypeValue, rows: ImportPreviewRow[]): Promise<void> {
  const numbers = [...new Set(rows.flatMap((row) => {
    const number = type === ImportType.STUDENTS ? row.values.studentNo : row.values.employeeNo;
    return typeof number === "string" && number ? [number] : [];
  }))];

  if (type === ImportType.STUDENTS) {
    const found = numbers.length
      ? await prisma.student.findMany({
          where: { studentNo: { in: numbers } },
          select: { studentNo: true, firstName: true, lastName: true, birthDate: true },
        })
      : [];
    validateUniqueNumbers(rows, type, new Set(found.map(({ studentNo }) => studentNo.toLocaleLowerCase())));

    const studentRows = rows.filter((row) =>
      Boolean(row.commitData && "studentNo" in row.commitData && "birthDate" in row.commitData),
    );
    const matches = studentRows.map((row) => {
      const values = row.commitData as CommitStudentData;
      const date = new Date(`${values.birthDate}T00:00:00.000Z`);
      return {
        firstName: values.firstName,
        lastName: values.lastName,
        birthDate: { gte: date, lt: new Date(date.getTime() + 86_400_000) },
      };
    });
    const existingMatches = matches.length
      ? await prisma.student.findMany({
          where: { OR: matches },
          select: { studentNo: true, firstName: true, lastName: true, birthDate: true },
        })
      : [];
    const duplicateMap = new Map<string, string[]>();
    for (const match of existingMatches) {
      if (!match.birthDate) continue;
      const key = `${match.firstName.toLocaleLowerCase()}|${match.lastName.toLocaleLowerCase()}|${match.birthDate.toISOString().slice(0, 10)}`;
      duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), match.studentNo]);
    }
    addPossibleDuplicateWarnings(rows, duplicateMap);
    return;
  }

  const found = numbers.length
    ? await prisma.teacher.findMany({
        where: { employeeNo: { in: numbers } },
        select: { employeeNo: true },
      })
    : [];
  validateUniqueNumbers(rows, type, new Set(found.map(({ employeeNo }) => employeeNo.toLocaleLowerCase())));
}

async function resolveSections(rows: ImportPreviewRow[], hasEnrollmentColumns: boolean): Promise<void> {
  if (!hasEnrollmentColumns) return;
  const enrollmentRows = rows.filter((row): row is ImportPreviewRow & { commitData: CommitStudentData } =>
    Boolean(row.errors.length === 0 && row.commitData && "studentNo" in row.commitData),
  );
  if (!enrollmentRows.length) return;
  const currentYear = await prisma.schoolYear.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  if (!currentYear) {
    for (const row of enrollmentRows) {
      row.errors.push({ field: "section", message: "No current school year is configured" });
    }
    return;
  }

  const requested = enrollmentRows.flatMap(({ commitData: row }) => {
    if (!row.gradeLevel || !row.section) return [];
    return [{ gradeLevel: row.gradeLevel, name: row.section }];
  });
  const unique = new Map(requested.map((value) => [`${value.gradeLevel}|${value.name.toLocaleLowerCase()}`, value]));
  const sections = unique.size
    ? await prisma.section.findMany({
        where: {
          schoolYearId: currentYear.id,
          OR: [...unique.values()].map(({ gradeLevel, name }) => ({
            gradeLevel,
            name: { equals: name, mode: "insensitive" as const },
          })),
        },
        select: { id: true, gradeLevel: true, name: true },
      })
    : [];
  const sectionsByName = new Map(
    sections.map((section) => [`${section.gradeLevel}|${section.name.toLocaleLowerCase()}`, section]),
  );

  for (const row of enrollmentRows) {
    const values = row.commitData;
    if (!values.gradeLevel || !values.section) {
      row.errors.push({ field: "section", message: "Both Grade Level and Section are required for enrollment" });
      continue;
    }
    const section = sectionsByName.get(`${values.gradeLevel}|${values.section.toLocaleLowerCase()}`);
    if (!section) {
      row.errors.push({
        field: "section",
        message: `Grade ${values.gradeLevel} ${values.section} does not exist in the current school year`,
      });
      continue;
    }
    values.sectionId = section.id;
    values.schoolYearId = currentYear.id;
  }
}

export function getImportTemplate(rawType: unknown): { type: ImportTypeValue; content: string } {
  const type = parseInput(importTypeSchema, rawType);
  return { type, content: csvTemplate(type) };
}

export async function previewImport(
  file: Express.Multer.File,
  rawType: unknown,
  rawOptions: unknown,
  request: Request,
) {
  const actorId = requestUserId(request);
  validateUpload(file);
  const type = parseInput(importTypeSchema, rawType);
  const options: ImportOptions = parseInput(previewOptionsSchema, rawOptions);
  const parsed = parseCsv(file.buffer);
  const headerMap = mapHeaders(parsed.headers, type);
  const rows = transformRows(parsed, headerMap, type, options);
  await checkNumbers(type, rows);
  await resolveSections(rows, headerMap.hasEnrollmentColumns);

  const counts = summarizeRows(rows);
  const fileHash = createHash("sha256").update(file.buffer).digest("hex");
  const job = await prisma.$transaction(async (transaction) => {
    const created = await transaction.importJob.create({
      data: {
        type,
        status: ImportStatus.PREVIEWED,
        fileName: sanitizeFileName(file.originalname),
        fileHash,
        options: {
          ...options,
          headers: parsed.headers,
          delimiter: parsed.delimiter,
        } as Prisma.InputJsonObject,
        ...counts,
        previewRows: rows as unknown as Prisma.InputJsonArray,
        expiresAt: new Date(Date.now() + PREVIEW_LIFETIME_MS),
        createdById: actorId,
      },
    });
    await logAudit({
      userId: actorId,
      action: "IMPORT_PREVIEW",
      entity: "ImportJob",
      entityId: created.id,
      details: auditDetails({ type, ...counts }),
      ipAddress: request.ip,
    }, transaction);
    return created;
  });
  return {
    ...summary(job),
    rows: rows.slice(0, 25).map(printableRow),
    meta: buildPaginationMeta(1, 25, rows.length),
  };
}

export async function getImportJob(id: string) {
  const job = await getJob(id);
  return summary(job);
}

export async function getImportRows(id: string, rawQuery: unknown) {
  const query = parseInput(importRowsQuerySchema, rawQuery);
  const job = await getJob(id);
  const rows = storedRows(job);
  const { skip, take } = parsePagination(query);
  return {
    data: rows.slice(skip, skip + take).map(printableRow),
    meta: buildPaginationMeta(query.page, query.pageSize, rows.length),
  };
}

export async function getRejectedCsv(id: string): Promise<{ fileName: string; content: string }> {
  const job = await getJob(id);
  const options = job.options as { headers?: unknown };
  const headers = Array.isArray(options?.headers)
    ? options.headers.filter((header): header is string => typeof header === "string")
    : [];
  const delimiter = options && "delimiter" in options && options.delimiter === ";"
    ? ";"
    : ",";
  const rows = storedRows(job);
  return {
    fileName: `${job.fileName.replace(/\.csv$/i, "")}-rejected.csv`,
    content: rejectedRowsCsv(
      { delimiter, headers, rows: [] },
      rows,
    ),
  };
}

export async function commitImport(id: string, rawBody: unknown, request: Request) {
  const actorId = requestUserId(request);
  const { rowNumbers } = parseInput(commitImportSchema, rawBody);
  let job = await getJob(id);
  if (job.createdById !== actorId) {
    throw new AppError("Only the administrator who created this preview can commit it", 403, "IMPORT_OWNER_REQUIRED");
  }
  if (job.status === ImportStatus.EXPIRED) {
    throw new AppError("This import preview has expired", 410, "IMPORT_EXPIRED");
  }
  if (job.status !== ImportStatus.PREVIEWED) {
    throw new AppError("This import preview is no longer available to commit", 409, "IMPORT_NOT_PREVIEWED");
  }
  if (job.expiresAt.getTime() <= Date.now()) {
    job = await expireJob(job);
    throw new AppError("This import preview has expired", 410, "IMPORT_EXPIRED");
  }

  const rows = storedRows(job);
  const selectable = rows.filter((row) => row.errors.length === 0);
  const requested = rowNumbers === undefined
    ? selectable
    : rows.filter((row) => rowNumbers.includes(row.rowNumber));
  if (rowNumbers && new Set(rowNumbers).size !== rowNumbers.length) {
    throw new AppError("rowNumbers must not contain duplicates", 400, "INVALID_ROWS");
  }
  if (rowNumbers && requested.length !== rowNumbers.length) {
    throw new AppError("One or more requested rows do not exist in this preview", 400, "INVALID_ROWS");
  }
  if (requested.some((row) => row.errors.length > 0)) {
    throw new AppError("Rows with validation errors cannot be committed", 400, "INVALID_ROWS");
  }
  if (!requested.length) {
    throw new AppError("There are no valid rows to import", 400, "NO_VALID_ROWS");
  }

  const commitResult = {
    selectedRows: requested.length,
    skippedRows: rows.length - requested.length,
    importedRows: requested.length,
  };

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const claim = await transaction.importJob.updateMany({
        where: {
          id: job.id,
          createdById: actorId,
          status: ImportStatus.PREVIEWED,
          expiresAt: { gt: new Date() },
        },
        data: { status: ImportStatus.COMMITTED },
      });
      if (claim.count !== 1) {
        throw new AppError("This import preview is no longer available to commit", 409, "IMPORT_NOT_PREVIEWED");
      }

      if (job.type === ImportType.STUDENTS) {
        const studentRows = requested.filter((row) => row.commitData && "studentNo" in row.commitData);
        const studentData = studentRows.map((row) => {
          const data = row.commitData as CommitStudentData;
          return {
            id: randomUUID(),
            source: data,
            record: {
              studentNo: data.studentNo,
              firstName: data.firstName,
              middleName: data.middleName,
              lastName: data.lastName,
              sex: data.sex,
              birthDate: new Date(`${data.birthDate}T00:00:00.000Z`),
              address: data.address,
              guardianName: data.guardianName,
              guardianContact: data.guardianContact,
            },
          };
        });
        await transaction.student.createMany({
          data: studentData.map(({ id, record }) => ({ id, ...record })),
        });
        const enrollments = studentData.flatMap(({ id, source }) => {
          const { sectionId, schoolYearId } = source;
          if (!sectionId || !schoolYearId) return [];
          return [{
            id: randomUUID(),
            studentId: id,
            sectionId,
            schoolYearId,
            status: EnrollmentStatus.ENROLLED,
          }];
        });
        if (enrollments.length) {
          await transaction.enrollment.createMany({
            data: enrollments,
          });
        }
      } else {
        const teacherRows = requested.filter((row) => row.commitData && "employeeNo" in row.commitData);
        await transaction.teacher.createMany({
          data: teacherRows.map((row) => {
            const data = row.commitData as {
              employeeNo: string; firstName: string; middleName: string | null;
              lastName: string; department: string | null; contactNo: string | null;
            };
            return { id: randomUUID(), ...data };
          }),
        });
      }

      await logAudit({
        userId: actorId,
        action: "IMPORT_COMMIT",
        entity: job.type === ImportType.STUDENTS ? "Student" : "Teacher",
        entityId: job.id,
        details: auditDetails({ type: job.type, ...commitResult }),
        ipAddress: request.ip,
      }, transaction);

      return transaction.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.COMMITTED,
          committedAt: new Date(),
          commitResult,
          previewRows: [],
        },
      });
    });
    return { ...summary(updated), result: commitResult };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        "Import conflicts with existing records. No rows were imported; preview the file again.",
        409,
        "IMPORT_CONFLICT",
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new AppError(
        "A referenced section or school year changed. No rows were imported; preview the file again.",
        409,
        "IMPORT_CONFLICT",
      );
    }
    throw error;
  }
}

export async function discardImport(id: string, request: Request) {
  const actorId = requestUserId(request);
  const job = await getJob(id);
  if (job.createdById !== actorId) {
    throw new AppError("Only the administrator who created this preview can discard it", 403, "IMPORT_OWNER_REQUIRED");
  }
  if (job.status !== ImportStatus.PREVIEWED) {
    throw new AppError("This import preview can no longer be discarded", 409, "IMPORT_NOT_PREVIEWED");
  }
  const updated = await prisma.$transaction(async (transaction) => {
    const claim = await transaction.importJob.updateMany({
      where: {
        id,
        createdById: actorId,
        status: ImportStatus.PREVIEWED,
        expiresAt: { gt: new Date() },
      },
      data: { status: ImportStatus.DISCARDED, previewRows: [] },
    });
    if (claim.count !== 1) {
      throw new AppError("This import preview can no longer be discarded", 409, "IMPORT_NOT_PREVIEWED");
    }
    const discarded = await transaction.importJob.findUniqueOrThrow({ where: { id } });
    await logAudit({
      userId: actorId,
      action: "IMPORT_DISCARD",
      entity: "ImportJob",
      entityId: id,
      details: auditDetails({ type: job.type, totalRows: job.totalRows }),
      ipAddress: request.ip,
    }, transaction);
    return discarded;
  });
  return summary(updated);
}

export async function listImportJobs(rawQuery: unknown) {
  const query = parseInput(importHistoryQuerySchema, rawQuery);
  const { skip, take } = parsePagination(query);
  await prisma.importJob.updateMany({
    where: { status: ImportStatus.PREVIEWED, expiresAt: { lte: new Date() } },
    data: { status: ImportStatus.EXPIRED, previewRows: [] },
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
        status: true,
        fileName: true,
        totalRows: true,
        validRows: true,
        warningRows: true,
        errorRows: true,
        expiresAt: true,
        committedAt: true,
        commitResult: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.importJob.count({ where }),
  ]);
  return { data: jobs, meta: buildPaginationMeta(query.page, query.pageSize, total) };
}
