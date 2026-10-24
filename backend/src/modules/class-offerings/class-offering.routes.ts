import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  bulkCreateClassOfferingsController,
  createClassOfferingController,
  deleteClassOfferingController,
  getClassOfferingController,
  getClassOfferingStudentsController,
  listClassOfferingsController,
  updateClassOfferingController,
} from "./class-offering.controller.js";
import {
  bulkCreateClassOfferingsSchema,
  createClassOfferingSchema,
  updateClassOfferingSchema,
} from "./class-offering.schema.js";
import {
  getClassAttendanceController,
  getClassAttendanceDatesController,
  getClassAttendanceSummaryController,
  saveClassAttendanceController,
} from "../attendance/attendance.controller.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate);
router.get("/", authorize(Role.ADMIN), listClassOfferingsController);
router.get("/:id/attendance/summary", getClassAttendanceSummaryController);
router.get("/:id/attendance/dates", getClassAttendanceDatesController);
router.get("/:id/attendance", getClassAttendanceController);
router.put("/:id/attendance", saveClassAttendanceController);
router.get("/:id/students", authorize(Role.ADMIN, Role.TEACHER), getClassOfferingStudentsController);
router.get("/:id", authorize(Role.ADMIN, Role.TEACHER), getClassOfferingController);
router.post("/", authorize(Role.ADMIN), validateBody(createClassOfferingSchema), createClassOfferingController);
router.post("/bulk", authorize(Role.ADMIN), validateBody(bulkCreateClassOfferingsSchema), bulkCreateClassOfferingsController);
router.patch("/:id", authorize(Role.ADMIN), validateBody(updateClassOfferingSchema), updateClassOfferingController);
router.delete("/:id", authorize(Role.ADMIN), deleteClassOfferingController);

export default router;
