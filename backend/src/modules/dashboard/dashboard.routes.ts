import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getAdminDashboardController,
  getStudentDashboardController,
  getTeacherDashboardController,
} from "./dashboard.controller.js";

const router = Router();
router.use(authenticate);

router.get("/admin", authorize(Role.ADMIN), getAdminDashboardController);
router.get("/teacher", authorize(Role.TEACHER), getTeacherDashboardController);
router.get("/student", authorize(Role.STUDENT), getStudentDashboardController);

export default router;
