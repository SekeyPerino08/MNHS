import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  getClassAttendance,
  getClassAttendanceDates,
  getClassAttendanceSummary,
  getMyAttendance,
  getStudentAttendance,
  saveClassAttendance,
} from "./attendance.service.js";

export const getClassAttendanceController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getClassAttendance(req.params.id, req.user, req.query));
});

export const saveClassAttendanceController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await saveClassAttendance(req.params.id, req.user, req.body, req));
});

export const getClassAttendanceSummaryController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getClassAttendanceSummary(req.params.id, req.user, req.query));
});

export const getClassAttendanceDatesController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getClassAttendanceDates(req.params.id, req.user, req.query));
});

export const getMyAttendanceController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyAttendance(req.user.id, req.query));
});

export const getStudentAttendanceController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json(await getStudentAttendance(req.params.id, req.query));
});
