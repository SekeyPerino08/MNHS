import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createSchoolYearController,
  currentSchoolYearController,
  listSchoolYearsController,
  setCurrentSchoolYearController,
  updateSchoolYearController,
  updateSchoolYearTermController,
} from "./school-year.controller.js";
import { createSchoolYearSchema, updateSchoolYearSchema, updateTermSchema } from "./school-year.schema.js";

const router = Router();
router.use(authenticate);
router.get("/", authorize(Role.ADMIN, Role.TEACHER), listSchoolYearsController);
router.get("/current", authorize(Role.ADMIN, Role.TEACHER, Role.STUDENT), currentSchoolYearController);
router.post("/", authorize(Role.ADMIN), validateBody(createSchoolYearSchema), createSchoolYearController);
router.patch("/:id/set-current", authorize(Role.ADMIN), setCurrentSchoolYearController);
router.patch("/:schoolYearId/terms/:termId", authorize(Role.ADMIN), validateBody(updateTermSchema), updateSchoolYearTermController);
router.patch("/:id", authorize(Role.ADMIN), validateBody(updateSchoolYearSchema), updateSchoolYearController);
// School years and terms are retained because academic records reference them.
export default router;
