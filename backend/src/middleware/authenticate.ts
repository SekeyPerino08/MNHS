import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.js";

const authenticateWithPendingPassword: (allowPending: boolean) => RequestHandler =
  (allowPending) => async (req, res, next) => {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token || typeof token !== "string") {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(token);
    } catch {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          tokenVersion: true,
          mustChangePassword: true,
        },
      });
      if (!user || !user.isActive || payload.ver !== user.tokenVersion) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      req.user = { id: user.id, email: user.email, role: user.role };
      if (user.mustChangePassword && !allowPending) {
        res.status(403).json({
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Change your password before continuing",
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export const authenticate: RequestHandler = authenticateWithPendingPassword(false);
export const authenticateAllowPending: RequestHandler = authenticateWithPendingPassword(true);
