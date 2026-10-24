import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createSubjectController,
  deleteSubjectController,
  getSubjectController,
  listSubjectsController,
  updateSubjectController,
} from "./subject.controller.js";
import { createSubjectSchema, updateSubjectSchema } from "./subject.schema.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate);
router.get("/", authorize(Role.ADMIN, Role.TEACHER), listSubjectsController);
router.get("/:id", authorize(Role.ADMIN, Role.TEACHER), getSubjectController);
router.post("/", authorize(Role.ADMIN), validateBody(createSubjectSchema), createSubjectController);
router.patch("/:id", authorize(Role.ADMIN), validateBody(updateSubjectSchema), updateSubjectController);
router.delete("/:id", authorize(Role.ADMIN), deleteSubjectController);
export default router;
