import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createSection, deleteSection, getSectionById, listSections, updateSection } from "./section.service.js";
import type { CreateSectionInput, UpdateSectionInput } from "./section.schema.js";

export const listSectionsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listSections(req.query));
});
export const getSectionController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getSectionById(req.params.id) });
});
export const createSectionController = asyncHandler<ParamsDictionary, unknown, CreateSectionInput>(async (req, res) => {
  res.status(201).json({ data: await createSection(req.body, req) });
});
export const updateSectionController = asyncHandler<ParamsDictionary, unknown, UpdateSectionInput>(async (req, res) => {
  res.status(200).json({ data: await updateSection(req.params.id, req.body, req) });
});
export const deleteSectionController = asyncHandler<ParamsDictionary>(async (req, res) => {
  await deleteSection(req.params.id, req);
  res.status(204).end();
});
