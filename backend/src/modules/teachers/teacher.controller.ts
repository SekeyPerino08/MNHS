import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  createTeacher,
  createTeacherAccount,
  getTeacherById,
  listTeachers,
  updateTeacher,
  updateTeacherStatus,
} from "./teacher.service.js";
import type {
  CreateTeacherAccountInput,
  CreateTeacherInput,
  UpdateTeacherInput,
  UpdateTeacherStatusInput,
} from "./teacher.schema.js";

export const listTeachersController = asyncHandler(async (req, res) => {
  res.status(200).json(await listTeachers(req.query));
});
export const getTeacherController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getTeacherById(req.params.id) });
});
export const createTeacherController = asyncHandler<ParamsDictionary, unknown, CreateTeacherInput>(async (req, res) => {
  res.status(201).json({ data: await createTeacher(req.body, req) });
});
export const updateTeacherController = asyncHandler<ParamsDictionary, unknown, UpdateTeacherInput>(async (req, res) => {
  res.status(200).json({ data: await updateTeacher(req.params.id, req.body, req) });
});
export const updateTeacherStatusController = asyncHandler<ParamsDictionary, unknown, UpdateTeacherStatusInput>(async (req, res) => {
  res.status(200).json({ data: await updateTeacherStatus(req.params.id, req.body, req) });
});
export const createTeacherAccountController = asyncHandler<ParamsDictionary, unknown, CreateTeacherAccountInput>(async (req, res) => {
  res.status(201).json({ data: await createTeacherAccount(req.params.id, req.body, req) });
});
