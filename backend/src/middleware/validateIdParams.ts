import type { RequestParamHandler } from "express";

const idPattern = /^[A-Za-z0-9_-]{10,64}$/;

export function validateIdParams(...names: string[]): RequestParamHandler {
  return (req, res, next, value, name) => {
    if (!names.includes(name) || typeof value !== "string" || !idPattern.test(value)) {
      res.status(400).json({
        message: "The identifier is invalid",
        code: "INVALID_ID",
        requestId: String(req.id),
      });
      return;
    }
    next();
  };
}
