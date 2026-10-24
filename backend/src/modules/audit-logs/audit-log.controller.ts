import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getAuditLog, getAuditLogFacets, listAuditLogs } from "./audit-log.service.js";

export const listAuditLogsController = asyncHandler(async (req, res) => {
  res.status(200).json(await listAuditLogs(req.query));
});

export const getAuditLogFacetsController = asyncHandler(async (_req, res) => {
  res.status(200).json(await getAuditLogFacets());
});

export const getAuditLogController = asyncHandler<ParamsDictionary>(async (req, res) => {
  res.status(200).json({ data: await getAuditLog(req.params.id) });
});
