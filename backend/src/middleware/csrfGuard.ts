import type { RequestHandler } from "express";
import { env } from "../config/env.js";

const allowedOrigins = new Set(env.CORS_ORIGIN);
const multipartImportPath = "/imports/preview";

function originFromReferer(referer: string): string | undefined {
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export const csrfGuard: RequestHandler = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("Origin");
  const referer = req.get("Referer");
  const refererOrigin = referer ? originFromReferer(referer) : undefined;
  const requestOrigin = origin ?? refererOrigin;
  if ((referer && origin === undefined && !refererOrigin)
    || (origin !== undefined && !allowedOrigins.has(origin))
    || (origin === undefined && requestOrigin !== undefined && !allowedOrigins.has(requestOrigin))) {
    res.status(403).json({
      code: "ORIGIN_NOT_ALLOWED",
      message: "The request origin is not allowed",
      requestId: String(req.id),
    });
    return;
  }

  const hasBody = Number(req.get("Content-Length") ?? 0) > 0 || Boolean(req.get("Transfer-Encoding"));
  const isMultipartImport = req.path.toLowerCase() === multipartImportPath && req.is("multipart/form-data");
  if (hasBody && !isMultipartImport && !req.is("application/json")) {
    res.status(415).json({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Requests with a body must use application/json",
      requestId: String(req.id),
    });
    return;
  }

  // Browsers send Origin on cross-origin POSTs; this blocks cross-site form submissions even with sameSite cookies.
  next();
};
