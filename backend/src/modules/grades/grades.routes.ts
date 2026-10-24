/*
 * Access rules:
 * - Teachers read and write only their assigned classes, and only unlocked terms.
 * - Admins can access all class grades and lock or unlock terms.
 * - Students see only their own released (locked) grades through /me/grades.
 * - Advisers have read-only access to the overview for their advisory section.
 */
import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  getClassGradesSummaryController,
  getGradesSheetController,
  getMyGradesController,
  getSectionGradeOverviewController,
  getStudentGradesController,
  getTermGradeCompletenessController,
  lockSchoolYearTermController,
  saveClassGradesController,
} from "./grades.controller.js";
import { saveGradesSchema, termLockSchema } from "./grades.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.param("schoolYearId", validateIdParams("schoolYearId"));
router.param("termId", validateIdParams("termId"));
router.use(authenticate);

router.get("/class-offerings/:id/grades/summary", authorize(Role.ADMIN, Role.TEACHER), getClassGradesSummaryController);
router.get("/class-offerings/:id/grades", authorize(Role.ADMIN, Role.TEACHER), getGradesSheetController);
router.put("/class-offerings/:id/grades", authorize(Role.ADMIN, Role.TEACHER), validateBody(saveGradesSchema), saveClassGradesController);

router.patch(
  "/school-years/:schoolYearId/terms/:termId/lock",
  authorize(Role.ADMIN),
  validateBody(termLockSchema),
  lockSchoolYearTermController,
);
router.get(
  "/school-years/:schoolYearId/terms/:termId/grade-completeness",
  authorize(Role.ADMIN),
  getTermGradeCompletenessController,
);

router.get("/me/grades", authorize(Role.STUDENT), getMyGradesController);
router.get("/students/:id/grades", authorize(Role.ADMIN), getStudentGradesController);
router.get("/sections/:id/grade-overview", authorize(Role.ADMIN, Role.TEACHER), getSectionGradeOverviewController);

export default router;
