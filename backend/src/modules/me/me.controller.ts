import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getMyClasses, getMyEnrollment, getMyProfile } from "./me.service.js";

export const getMyProfileController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyProfile(req.user.id));
});

export const getMyClassesController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyClasses(req.user.id, req.query));
});

export const getMyEnrollmentController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyEnrollment(req.user.id));
});
