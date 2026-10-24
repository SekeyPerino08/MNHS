import { ImportType } from "@prisma/client";
import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { logAudit } from "../../services/audit.service.js";
import {
  commitImport,
  discardImport,
  getImportJob,
  getImportRows,
  getImportTemplateResponse,
  getRejectedCsv,
  listImportJobs,
  previewImport,
} from "./import.service.js";

function auditActor(request: Parameters<RequestHandler>[0]): string | undefined {
  return request.user?.id;
}

export const studentTemplateController: RequestHandler = asyncHandler(async (request, response) => {
  const { content } = await getImportTemplateResponse(ImportType.STUDENTS);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_TEMPLATE_DOWNLOAD",
    entity: "ImportJob",
    details: { type: ImportType.STUDENTS },
    ipAddress: request.ip,
  });
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", 'attachment; filename="students-template.csv"');
  response.send(content);
});

export const teacherTemplateController: RequestHandler = asyncHandler(async (request, response) => {
  const { content } = await getImportTemplateResponse(ImportType.TEACHERS);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_TEMPLATE_DOWNLOAD",
    entity: "ImportJob",
    details: { type: ImportType.TEACHERS },
    ipAddress: request.ip,
  });
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", 'attachment; filename="teachers-template.csv"');
  response.send(content);
});

export const previewController: RequestHandler = asyncHandler(async (request, response) => {
  if (!request.file) throw new AppError("A CSV file is required", 400, "FILE_REQUIRED");
  response.status(201).json(await previewImport(request.file, request.body, request));
});

export const importHistoryController: RequestHandler = asyncHandler(async (request, response) => {
  const result = await listImportJobs(request.query);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_HISTORY_VIEW",
    entity: "ImportJob",
    ipAddress: request.ip,
  });
  response.json(result);
});

export const importJobController: RequestHandler = asyncHandler(async (request, response) => {
  const result = await getImportJob(request.params.id);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_JOB_VIEW",
    entity: "ImportJob",
    entityId: request.params.id,
    ipAddress: request.ip,
  });
  response.json(result);
});

export const importRowsController: RequestHandler = asyncHandler(async (request, response) => {
  const result = await getImportRows(request.params.id, request.query);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_ROWS_VIEW",
    entity: "ImportJob",
    entityId: request.params.id,
    ipAddress: request.ip,
  });
  response.json(result);
});

export const rejectedCsvController: RequestHandler = asyncHandler(async (request, response) => {
  const { fileName, content } = await getRejectedCsv(request.params.id);
  await logAudit({
    userId: auditActor(request),
    action: "IMPORT_REJECTED_DOWNLOAD",
    entity: "ImportJob",
    entityId: request.params.id,
    ipAddress: request.ip,
  });
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  response.send(content);
});

export const commitImportController: RequestHandler = asyncHandler(async (request, response) => {
  response.json(await commitImport(request.params.id, request.body, request));
});

export const discardImportController: RequestHandler = asyncHandler(async (request, response) => {
  response.json(await discardImport(request.params.id, request));
});
