import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.js";

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token || typeof token !== "string") {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ message: "Not authenticated" });
  }
};

export const optionalAuthenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token || typeof token !== "string") {
    next();
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    next();
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (user?.isActive) {
      req.user = { id: user.id, email: user.email, role: user.role };
    }
    next();
  } catch (error) {
    next(error);
  }
};
