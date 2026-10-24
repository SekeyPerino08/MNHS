import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createTeacherAccountController,
  createTeacherController,
  getTeacherController,
  listTeachersController,
  updateTeacherController,
  updateTeacherStatusController,
} from "./teacher.controller.js";
import {
  createTeacherAccountSchema,
  createTeacherSchema,
  updateTeacherSchema,
  updateTeacherStatusSchema,
} from "./teacher.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", listTeachersController);
router.get("/:id", getTeacherController);
router.post("/", validateBody(createTeacherSchema), createTeacherController);
router.patch("/:id", validateBody(updateTeacherSchema), updateTeacherController);
router.patch("/:id/status", validateBody(updateTeacherStatusSchema), updateTeacherStatusController);
router.post("/:id/account", validateBody(createTeacherAccountSchema), createTeacherAccountController);
// Teacher records are retained because class and enrollment history must remain attributable.
export default router;
