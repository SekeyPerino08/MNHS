import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getAdminDashboard, getStudentDashboard, getTeacherDashboard } from "./dashboard.service.js";

export const getAdminDashboardController = asyncHandler(async (req, res) => {
  res.status(200).json(await getAdminDashboard());
});

export const getTeacherDashboardController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getTeacherDashboard(req.user.id));
});

export const getStudentDashboardController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getStudentDashboard(req.user.id));
});
