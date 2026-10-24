// Converts application errors into JSON HTTP responses.
import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import { AppError } from "../utils/AppError.js";

function zodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

function flattenErrors(value: unknown, field = "request"): { field: string; message: string }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string"
      ? [{ field, message: item }]
      : flattenErrors(item, field));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flattenErrors(item, field === "request" ? key : `${field}.${key}`));
  }
  return typeof value === "string" ? [{ field, message: value }] : [];
}

function sendError(
  res: Parameters<ErrorRequestHandler>[2],
  status: number,
  message: string,
  code?: string,
  errors?: unknown[],
  requestId?: string,
): void {
  res.status(status).json({
    message,
    ...(code ? { code } : {}),
    ...(errors ? { errors } : {}),
    requestId,
  });
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  logger.error({ err: error, requestId: req.id }, "Request failed");

  if (error instanceof AppError) {
    const detailsErrors = error.details?.errors;
    const errors = detailsErrors === undefined ? undefined : flattenErrors(detailsErrors);
    sendError(res, error.statusCode, error.message, error.code, errors, String(req.id));
    return;
  }
  if (error instanceof ZodError) {
    sendError(res, 400, "Validation failed", "VALIDATION_ERROR", zodErrors(error), String(req.id));
    return;
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    sendError(
      res,
      tooLarge ? 413 : 400,
      tooLarge ? "The uploaded file is too large" : "The uploaded file could not be accepted",
      tooLarge ? "PAYLOAD_TOO_LARGE" : "UPLOAD_ERROR",
      undefined,
      String(req.id),
    );
    return;
  }
  if (error && typeof error === "object" && "type" in error) {
    const parserError = error as { type?: string; status?: number };
    if (parserError.type === "entity.parse.failed") {
      sendError(res, 400, "The request contains malformed JSON", "INVALID_JSON", undefined, String(req.id));
      return;
    }
    if (parserError.type === "entity.too.large") {
      sendError(res, 413, "The request body is too large", "PAYLOAD_TOO_LARGE", undefined, String(req.id));
      return;
    }
  }
  if (error instanceof SyntaxError && "body" in error) {
    sendError(res, 400, "The request contains malformed JSON", "INVALID_JSON", undefined, String(req.id));
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      sendError(res, 409, "A record with this value already exists", "CONFLICT", undefined, String(req.id));
      return;
    }
    if (error.code === "P2025") {
      sendError(res, 404, "Record not found", "NOT_FOUND", undefined, String(req.id));
      return;
    }
    if (error.code === "P2034") {
      sendError(res, 409, "Concurrent update conflict; please retry", "CONFLICT", undefined, String(req.id));
      return;
    }
  }

  sendError(res, 500, "Something went wrong", "INTERNAL_ERROR", undefined, String(req.id));
};
