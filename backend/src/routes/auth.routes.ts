import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  adminTestController,
  authTestRoles,
  changePasswordController,
  loginController,
  logoutController,
  meController,
  teacherTestController,
} from "../controllers/auth.controller.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateBody } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema } from "../schemas/auth.schema.js";

const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later" });
  },
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), loginController);
authRouter.post("/logout", optionalAuthenticate, logoutController);
authRouter.get("/me", authenticate, meController);
authRouter.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  changePasswordController,
);
authRouter.get("/test/admin", authenticate, authorize(...authTestRoles.admin), adminTestController);
authRouter.get("/test/teacher", authenticate, authorize(...authTestRoles.teacher), teacherTestController);

export default authRouter;
