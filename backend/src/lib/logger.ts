import type { Request, Response } from "express";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";

const sensitiveNames = [
  "authorization", "cookie", "set-cookie", "password", "newPassword",
  "currentPassword", "temporaryPassword", "passwordHash", "token",
  "body", "requestBody", "responseBody",
];
const redactionPaths = sensitiveNames.flatMap((name) => (
  Array.from({ length: 9 }, (_, depth) => `${Array.from({ length: depth }, () => "*").join(".")}${depth ? "." : ""}${name}`)
));

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: { paths: redactionPaths, censor: "[REDACTED]" },
  ...(env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" } } }
    : {}),
});

export const httpLogger = pinoHttp<Request, Response>({
  logger,
  genReqId: (req) => String(req.id),
  customProps: (req) => ({
    requestId: String(req.id),
    method: req.method,
    route: req.route ? `${req.baseUrl}${req.route.path}` : req.path,
  }),
  serializers: {
    req: (req) => ({ id: String(req.id), method: req.method, route: req.url?.split("?")[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
