import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  getClassGradesSummary,
  getGradesSheet,
  getMyGrades,
  getSectionGradeOverview,
  getStudentGrades,
  getTermGradeCompleteness,
  lockSchoolYearTerm,
  saveClassGrades,
} from "./grades.service.js";
import type { SaveGradesInput, TermLockInput } from "./grades.schema.js";

export const getGradesSheetController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getGradesSheet(req.params.id, req.user));
});

export const saveClassGradesController = asyncHandler<ParamsDictionary, unknown, SaveGradesInput>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await saveClassGrades(req.params.id, req.user, req.body, req));
});

export const getClassGradesSummaryController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getClassGradesSummary(req.params.id, req.user, req.query));
});

export const lockSchoolYearTermController = asyncHandler<
  ParamsDictionary,
  unknown,
  TermLockInput
>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await lockSchoolYearTerm(
    req.params.schoolYearId,
    req.params.termId,
    req.user,
    req.body,
    req,
  ));
});

export const getTermGradeCompletenessController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json(await getTermGradeCompleteness(req.params.schoolYearId, req.params.termId));
});

export const getMyGradesController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getMyGrades(req.user.id, req.query));
});

export const getStudentGradesController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json(await getStudentGrades(req.params.id, req.query));
});

export const getSectionGradeOverviewController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getSectionGradeOverview(req.params.id, req.user, req.query));
});
