import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createSchoolYear,
  getCurrentSchoolYear,
  listSchoolYears,
  setCurrentSchoolYear,
  updateSchoolYear,
  updateSchoolYearTerm,
} from "./school-year.service.js";
import type { CreateSchoolYearInput, UpdateSchoolYearInput, UpdateTermInput } from "./school-year.schema.js";

export const listSchoolYearsController = asyncHandler(async (_req, res) => {
  res.status(200).json({ data: await listSchoolYears() });
});
export const currentSchoolYearController = asyncHandler(async (_req, res) => {
  res.status(200).json({ data: await getCurrentSchoolYear() });
});
export const createSchoolYearController = asyncHandler<ParamsDictionary, unknown, CreateSchoolYearInput>(async (req, res) => {
  res.status(201).json({ data: await createSchoolYear(req.body, req) });
});
export const updateSchoolYearController = asyncHandler<ParamsDictionary, unknown, UpdateSchoolYearInput>(async (req, res) => {
  res.status(200).json({ data: await updateSchoolYear(req.params.id, req.body, req) });
});
export const setCurrentSchoolYearController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await setCurrentSchoolYear(req.params.id, req) });
});
export const updateSchoolYearTermController = asyncHandler<ParamsDictionary, unknown, UpdateTermInput>(async (req, res) => {
  res.status(200).json({ data: await updateSchoolYearTerm(req.params.schoolYearId, req.params.termId, req.body, req) });
});
