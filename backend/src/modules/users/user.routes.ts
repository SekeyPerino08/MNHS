import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  changeUserEmailController,
  createAdminUserController,
  forceLogoutUserController,
  listUsersController,
  resetUserPasswordController,
  unlockUserController,
  updateUserStatusController,
} from "./user.controller.js";
import {
  changeEmailSchema,
  createAdminUserSchema,
  resetPasswordSchema,
  updateUserStatusSchema,
} from "./user.schema.js";

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", listUsersController);
router.post("/", validateBody(createAdminUserSchema), createAdminUserController);
router.patch("/:id/email", validateBody(changeEmailSchema), changeUserEmailController);
router.post("/:id/reset-password", validateBody(resetPasswordSchema), resetUserPasswordController);
router.patch("/:id/status", validateBody(updateUserStatusSchema), updateUserStatusController);
router.post("/:id/unlock", unlockUserController);
router.post("/:id/force-logout", forceLogoutUserController);
// Accounts are deactivated rather than deleted so historical records remain attributable.

export default router;
