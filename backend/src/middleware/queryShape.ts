import type { RequestHandler } from "express";

export const queryShape: RequestHandler = (req, res, next) => {
  const hasNonStringValue = Object.entries(req.query).some(([key, value]) => (
    typeof value !== "string" || key.includes("[") || key.includes("]")
  ));
  if (hasNonStringValue) {
    res.status(400).json({
      message: "Query parameters must have a single string value",
      code: "VALIDATION_ERROR",
      errors: [{ field: "query", messages: ["Arrays and nested query parameters are not supported"] }],
      requestId: String(req.id),
    });
    return;
  }
  next();
};
