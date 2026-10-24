import type { RequestHandler } from "express";

export const apiHeaders: RequestHandler = (req, res, next) => {
  const path = req.path.toLowerCase();
  const isCsvTemplate = path === "/api/imports/templates/students.csv"
    || path === "/api/imports/templates/teachers.csv";
  if (path === "/api" || path.startsWith("/api/")) {
    if (!isCsvTemplate) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
    }
  }
  next();
};
