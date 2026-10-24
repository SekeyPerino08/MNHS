import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  commitImport,
  discardImport,
  getImportJob,
  getImportRows,
  getImportTemplate,
  getRejectedCsv,
  listImportJobs,
  previewImport,
} from "./import.service.js";

export const templateController: RequestHandler = asyncHandler(async (request, response) => {
  const { type, content } = getImportTemplate(request.params.type);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${type.toLocaleLowerCase()}-template.csv"`);
  response.send(content);
});

export const previewController: RequestHandler = asyncHandler(async (request, response) => {
  if (!request.file) throw new AppError("A CSV file is required", 400, "FILE_REQUIRED");
  response.status(201).json(
    await previewImport(request.file, request.params.type, request.body, request),
  );
});

export const importHistoryController: RequestHandler = asyncHandler(async (request, response) => {
  response.json(await listImportJobs(request.query));
});

export const importJobController: RequestHandler = asyncHandler(async (request, response) => {
  response.json(await getImportJob(request.params.id));
});

export const importRowsController: RequestHandler = asyncHandler(async (request, response) => {
  response.json(await getImportRows(request.params.id, request.query));
});

export const rejectedCsvController: RequestHandler = asyncHandler(async (request, response) => {
  const { fileName, content } = await getRejectedCsv(request.params.id);
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
