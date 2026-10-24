import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const requestIdPattern = /^[A-Za-z0-9_-]{8,64}$/;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const supplied = req.get("X-Request-Id");
  req.id = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
  res.setHeader("X-Request-Id", String(req.id));
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 400) return sendJson(body);
    if (req.originalUrl.split("?")[0] === "/api/health") return sendJson(body);
    const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const errors = Array.isArray(value.errors)
      ? value.errors
      : value.errors && typeof value.errors === "object"
        ? Object.entries(value.errors as Record<string, unknown>).flatMap(([field, messages]) => (
          Array.isArray(messages) ? messages.map((message) => ({ field, message })) : []
        ))
        : undefined;
    return sendJson({
      message: typeof value.message === "string" ? value.message : "Request failed",
      ...(typeof value.code === "string" ? { code: value.code } : {}),
      ...(errors ? { errors } : {}),
      requestId: String(req.id),
    });
  }) as typeof res.json;
  next();
};
