import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getReportsForRole, runReportExport } from "./reports.service.js";

export const reportsCatalogController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(getReportsForRole(req.user.role));
});

export const reportExportController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  await runReportExport(
    req.params.key,
    req.query,
    req.query.preview === "true",
    req.user,
    { ip: req.ip },
    res,
  );
});
