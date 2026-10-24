import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { CHANGE_PASSWORD_RATE_LIMIT, LOGIN_RATE_LIMIT } from "../config/limits.js";
import {
  changePasswordController,
  loginController,
  logoutController,
  logoutAllController,
  meController,
} from "../controllers/auth.controller.js";
import { authenticate, authenticateAllowPending } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema } from "../schemas/auth.schema.js";

const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later", code: "RATE_LIMITED", requestId: String(req.id) });
  },
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), loginController);
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: CHANGE_PASSWORD_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "unauthenticated",
  handler: (req, res) => {
    res.status(429).json({ message: "Too many attempts, try again later", code: "RATE_LIMITED", requestId: String(req.id) });
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

export default authRouter;
