// Converts application errors into JSON HTTP responses.
import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "A record with this value already exists", code: "CONFLICT" });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ message: "Record not found", code: "NOT_FOUND" });
      return;
    }
    if (error.code === "P2034") {
      res.status(409).json({ message: "Concurrent update conflict; please retry", code: "CONFLICT" });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
