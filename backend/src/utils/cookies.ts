import type { Response } from "express";
import { env } from "../config/env.js";
import { durationToMilliseconds } from "./duration.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookie(res: Response, token: string): void {
  // Cross-domain production deployments (Vercel + Render) will need sameSite "none" with secure true.
  res.cookie(env.COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: durationToMilliseconds(env.JWT_EXPIRES_IN),
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
}
