import type { Response } from "express";
import { env } from "../config/env.js";
import { durationToMilliseconds } from "./duration.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production" || env.COOKIE_SAMESITE === "none",
  sameSite: env.COOKIE_SAMESITE,
  path: "/",
};

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: durationToMilliseconds(env.JWT_EXPIRES_IN),
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, cookieOptions);
}
