import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import {
  bulkCreateClassOfferings,
  createClassOffering,
  deleteClassOffering,
  getClassOfferingById,
  getClassOfferingStudents,
  listClassOfferings,
  updateClassOffering,
} from "./class-offering.service.js";
import type {
  BulkCreateClassOfferingsInput,
  CreateClassOfferingInput,
  UpdateClassOfferingInput,
} from "./class-offering.schema.js";

export const listClassOfferingsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listClassOfferings(req.query));
});

export const getClassOfferingController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getClassOfferingById(req.params.id, req.user) });
});

export const getClassOfferingStudentsController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json({ data: await getClassOfferingStudents(req.params.id, req.user) });
});

export const createClassOfferingController = asyncHandler<
  ParamsDictionary,
  unknown,
  CreateClassOfferingInput
>(async (req, res) => {
  res.status(201).json({ data: await createClassOffering(req.body, req) });
});

export const bulkCreateClassOfferingsController = asyncHandler<
  ParamsDictionary,
  unknown,
  BulkCreateClassOfferingsInput
>(async (req, res) => {
  res.status(200).json(await bulkCreateClassOfferings(req.body, req));
});

export const updateClassOfferingController = asyncHandler<
  ParamsDictionary,
  unknown,
  UpdateClassOfferingInput
>(async (req, res) => {
  res.status(200).json({ data: await updateClassOffering(req.params.id, req.body, req) });
});

export const deleteClassOfferingController = asyncHandler<ParamsDictionary>(async (req, res) => {
  await deleteClassOffering(req.params.id, req);
  res.status(204).end();
});
