import type { ParamsDictionary } from "express-serve-static-core";
import { Role } from "@prisma/client";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { logAudit } from "../../services/audit.service.js";
import {
  getAvailableSchoolYearsForStudent,
  getSectionReportCards,
  getStudentReportCard,
} from "./report-cards.service.js";

export const getMyReportCardController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getStudentReportCard(req.user.id, undefined, req.query, req.user));
});

export const getStudentReportCardController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  const result = await getStudentReportCard(req.params.id, req.query.schoolYearId as string | undefined, req.query, req.user);
  if (req.user.role !== Role.STUDENT) {
    await logAudit({
      userId: req.user.id,
      action: "REPORT_CARD_VIEW",
      entity: "Student",
      entityId: req.params.id,
      details: {
        schoolYearId: req.query.schoolYearId ?? null,
        includeUnreleased: Boolean(req.query.includeUnreleased === "true" || req.query.includeUnreleased === "1"),
      },
    });
  }
  res.status(200).json(result);
});

export const getSectionReportCardsController = asyncHandler<ParamsDictionary>(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  const result = await getSectionReportCards(req.params.id, req.query, req.user);
  await logAudit({
    userId: req.user.id,
    action: "REPORT_CARD_BATCH_VIEW",
    entity: "Section",
    entityId: req.params.id,
    details: {
      count: result.length,
      includeUnreleased: Boolean(req.query.includeUnreleased === "true" || req.query.includeUnreleased === "1"),
    },
  });
  res.status(200).json(result);
});

export const getStudentAvailableYearsController = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError("Not authenticated", 401);
  res.status(200).json(await getAvailableSchoolYearsForStudent(req.user.id));
});
