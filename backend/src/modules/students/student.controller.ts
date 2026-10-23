import type { ParamsDictionary } from "express-serve-static-core";
import {
  createStudentAccount,
  createStudent,
  getStudentById,
  listStudents,
  updateStudent,
  updateStudentStatus,
} from "./student.service.js";
import type {
  CreateAccountInput,
  CreateStudentInput,
  UpdateStatusInput,
  UpdateStudentInput,
} from "./student.schema.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const listStudentsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listStudents(req.query));
});

export const getStudentController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json(await getStudentById(req.params.id));
});

export const createStudentController = asyncHandler<
  ParamsDictionary,
  unknown,
  CreateStudentInput
>(async (req, res) => {
  const student = await createStudent(
    req.body,
    req,
    req.headers["x-confirm-duplicate"],
  );
  res.status(201).json({ data: student });
});

export const updateStudentController = asyncHandler<
  ParamsDictionary,
  unknown,
  UpdateStudentInput
>(async (req, res) => {
  const student = await updateStudent(req.params.id, req.body, req);
  res.status(200).json({ data: student });
});

export const updateStudentStatusController = asyncHandler<
  ParamsDictionary,
  unknown,
  UpdateStatusInput
>(async (req, res) => {
  const student = await updateStudentStatus(req.params.id, req.body, req);
  res.status(200).json({ data: student });
});

export const createStudentAccountController = asyncHandler<
  ParamsDictionary,
  unknown,
  CreateAccountInput
>(async (req, res) => {
  const account = await createStudentAccount(req.params.id, req.body, req);
  res.status(201).json({ data: account });
});
