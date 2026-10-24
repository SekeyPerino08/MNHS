import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  adminTestController,
  authTestRoles,
  changePasswordController,
  loginController,
  logoutController,
  logoutAllController,
  meController,
  teacherTestController,
} from "../controllers/auth.controller.js";
import { authenticate, authenticateAllowPending } from "../middleware/authenticate.js";
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
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "unauthenticated",
  handler: (_req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later" });
  },
});

authRouter.post("/logout", authenticateAllowPending, logoutController);
authRouter.get("/me", authenticateAllowPending, meController);
authRouter.post(
  "/change-password",
  authenticateAllowPending,
  changePasswordLimiter,
  validateBody(changePasswordSchema),
  changePasswordController,
);
authRouter.post("/logout-all", authenticate, logoutAllController);
authRouter.get("/test/admin", authenticate, authorize(...authTestRoles.admin), adminTestController);
authRouter.get("/test/teacher", authenticate, authorize(...authTestRoles.teacher), teacherTestController);

export default authRouter;
