import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  bulkEnroll,
  createEnrollment,
  listEnrollments,
  listUnassignedStudents,
  transferEnrollment,
  updateEnrollmentStatus,
} from "./enrollment.service.js";
import type {
  BulkEnrollInput,
  CreateEnrollmentInput,
  UpdateEnrollmentStatusInput,
} from "./enrollment.schema.js";

export const listEnrollmentsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listEnrollments(req.query));
});

export const listUnassignedStudentsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listUnassignedStudents(req.query));
});

export const createEnrollmentController = asyncHandler<ParamsDictionary, unknown, CreateEnrollmentInput>(
  async (req, res) => {
    res.status(201).json({ data: await createEnrollment(req.body, req) });
  },
);

export const bulkEnrollController = asyncHandler<ParamsDictionary, unknown, BulkEnrollInput>(
  async (req, res) => {
    res.status(200).json(await bulkEnroll(req.body, req));
  },
);

export const transferEnrollmentController = asyncHandler<ParamsDictionary, unknown, { sectionId: string }>(
  async (req, res) => {
    res.status(200).json({ data: await transferEnrollment(req.params.id, req.body.sectionId, req) });
  },
);

export const updateEnrollmentStatusController = asyncHandler<
  ParamsDictionary,
  unknown,
  UpdateEnrollmentStatusInput
>(async (req, res) => {
  res.status(200).json({ data: await updateEnrollmentStatus(req.params.id, req.body, req) });
});
