import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getMyReportCardController,
  getSectionReportCardsController,
  getStudentAvailableYearsController,
  getStudentReportCardController,
} from "./report-cards.controller.js";

/**
 * Access rules:
 * - Teachers: read and write only their own classes, only unlocked terms.
 * - Admins: everything.
 * - Students: only their own released (locked) grades through /api/me/grades.
 * - Advisers: read-only overview of their own advisory section.
 */
const router = Router();

router.use(authenticate);
router.get("/me/report-card", authorize(Role.STUDENT), getMyReportCardController);
router.get("/me/report-card/available-years", authorize(Role.STUDENT), getStudentAvailableYearsController);
router.get("/students/:id/report-card", authorize(Role.ADMIN, Role.TEACHER, Role.STUDENT), getStudentReportCardController);
router.get("/sections/:id/report-cards", authorize(Role.ADMIN, Role.TEACHER), getSectionReportCardsController);

export default router;
