// Converts application errors into JSON HTTP responses.
import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...error.details,
    });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
