import type { RequestHandler } from "express";
import type { ChangePasswordBody, LoginBody } from "../schemas/auth.schema.js";
import { logAudit } from "../services/audit.service.js";
import { changePassword, getAuthUser, login, logoutAll } from "../services/auth.service.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";

export const loginController: RequestHandler<object, unknown, LoginBody> = async (req, res, next) => {
  try {
    const result = await login(req.body.email, req.body.password, req.ip);
    setAuthCookie(res, result.token);
    res.status(200).json({ user: result.user });
  } catch (error) {
    next(error);
  }
};

export const logoutController: RequestHandler = async (req, res, next) => {
  try {
    clearAuthCookie(res);
    if (req.user) {
      await logAudit({
        userId: req.user.id,
        action: "LOGOUT",
        entity: "User",
        entityId: req.user.id,
        ipAddress: req.ip,
      });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const meController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    res.status(200).json({ user: await getAuthUser(req.user.id) });
  } catch (error) {
    next(error);
  }
};

export const changePasswordController: RequestHandler<object, unknown, ChangePasswordBody> = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const token = await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword, req.ip);
    setAuthCookie(res, token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const logoutAllController: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    await logoutAll(req.user.id, req.ip);
    clearAuthCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
