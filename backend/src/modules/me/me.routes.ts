import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getMyClassesController, getMyEnrollmentController } from "./me.controller.js";
import { getMyAttendanceController } from "../attendance/attendance.controller.js";

const router = Router();
router.use(authenticate);
router.get("/classes", authorize(Role.TEACHER), getMyClassesController);
router.get("/enrollment", authorize(Role.STUDENT), getMyEnrollmentController);
router.get("/attendance", authorize(Role.STUDENT), getMyAttendanceController);

export default router;
