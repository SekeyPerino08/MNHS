/*
 * Access summary:
 * - Admins may run every report.
 * - Teachers may run only their assigned classes and advisory section.
 * - Students have no export access.
 */
import { Role } from "@prisma/client";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { EXPORT_RATE_LIMIT_PER_HOUR } from "../../config/limits.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { reportsCatalogController, reportExportController } from "./reports.controller.js";

const router = Router();

const csvExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: EXPORT_RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "unauthenticated",
  skip: (req) => req.query.preview === "true",
  handler: (req, res) => {
    res.status(429).json({
      message: "You have reached the export limit. Try again in an hour.",
      code: "RATE_LIMITED",
      requestId: String(req.id),
    });
  },
});

router.use(authenticate, authorize(Role.ADMIN, Role.TEACHER));
router.get("/", reportsCatalogController);
router.get("/:key", csvExportLimiter, reportExportController);

export default router;
