import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  changeUserEmail,
  createAdminUser,
  forceLogoutUser,
  listUsers,
  resetUserPassword,
  unlockUser,
  updateUserStatus,
} from "./user.service.js";
import type {
  ChangeEmailBody,
  CreateAdminUserBody,
  ResetPasswordBody,
  UpdateUserStatusBody,
} from "./user.schema.js";

function actorId(req: { user?: { id: string } }): string {
  if (!req.user) throw new AppError("Not authenticated", 401);
  return req.user.id;
}

export const listUsersController = asyncHandler(async (req, res) => {
  res.status(200).json(await listUsers(req.query));
});

export const createAdminUserController = asyncHandler<
  ParamsDictionary,
  unknown,
  CreateAdminUserBody
>(async (req, res) => {
  const result = await createAdminUser(req.body, actorId(req), req.ip);
  res.status(201).json(result);
});

export const changeUserEmailController = asyncHandler<
  ParamsDictionary,
  unknown,
  ChangeEmailBody
>(async (req, res) => {
  res.status(200).json({
    data: await changeUserEmail(req.params.id, req.body, actorId(req), req.ip),
  });
});

export const resetUserPasswordController = asyncHandler<
  ParamsDictionary,
  unknown,
  ResetPasswordBody
>(async (req, res) => {
  res.status(200).json(await resetUserPassword(req.params.id, req.body, actorId(req), req.ip));
});

export const updateUserStatusController = asyncHandler<
  ParamsDictionary,
  unknown,
  UpdateUserStatusBody
>(async (req, res) => {
  res.status(200).json({
    data: await updateUserStatus(req.params.id, req.body, actorId(req), req.ip),
  });
});

export const unlockUserController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({
    data: await unlockUser(req.params.id, actorId(req), req.ip),
  });
});

export const forceLogoutUserController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({
    data: await forceLogoutUser(req.params.id, actorId(req), req.ip),
  });
});
