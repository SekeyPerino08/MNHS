import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createStudentAccountController,
  createStudentController,
  getStudentController,
  listStudentsController,
  updateStudentController,
  updateStudentStatusController,
} from "./student.controller.js";
import {
  createAccountSchema,
  createStudentSchema,
  updateStatusSchema,
  updateStudentSchema,
} from "./student.schema.js";
import { getStudentAttendanceController } from "../attendance/attendance.controller.js";

const studentRouter = Router();
const adminOnly = [authenticate, authorize(Role.ADMIN)];

studentRouter.use(...adminOnly);
studentRouter.get("/", listStudentsController);
studentRouter.get("/:id/attendance", getStudentAttendanceController);
studentRouter.get("/:id", getStudentController);
studentRouter.post("/", validateBody(createStudentSchema), createStudentController);
studentRouter.patch("/:id", validateBody(updateStudentSchema), updateStudentController);
studentRouter.patch(
  "/:id/status",
  validateBody(updateStatusSchema),
  updateStudentStatusController,
);
studentRouter.post(
  "/:id/account",
  validateBody(createAccountSchema),
  createStudentAccountController,
);

// Student records are retained to preserve enrollment and academic history; there is no DELETE route.
export default studentRouter;
