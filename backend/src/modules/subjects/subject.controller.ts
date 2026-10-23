import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createSubject, deleteSubject, getSubjectById, listSubjects, updateSubject } from "./subject.service.js";
import type { CreateSubjectInput, UpdateSubjectInput } from "./subject.schema.js";

export const listSubjectsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listSubjects(req.query));
});
export const getSubjectController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getSubjectById(req.params.id) });
});
export const createSubjectController = asyncHandler<ParamsDictionary, unknown, CreateSubjectInput>(async (req, res) => {
  res.status(201).json({ data: await createSubject(req.body, req) });
});
export const updateSubjectController = asyncHandler<ParamsDictionary, unknown, UpdateSubjectInput>(async (req, res) => {
  res.status(200).json({ data: await updateSubject(req.params.id, req.body, req) });
});
export const deleteSubjectController = asyncHandler<ParamsDictionary>(async (req, res) => {
  await deleteSubject(req.params.id, req);
  res.status(204).end();
});
