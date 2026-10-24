import { Role } from "@prisma/client";
import { Router } from "express";
import { validateIdParams } from "../../middleware/validateIdParams.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getAuditLogController,
  getAuditLogFacetsController,
  listAuditLogsController,
} from "./audit-log.controller.js";

const router = Router();
router.param("id", validateIdParams("id"));
router.use(authenticate, authorize(Role.ADMIN));
router.get("/", listAuditLogsController);
router.get("/facets", getAuditLogFacetsController);
router.get("/:id", getAuditLogController);

export default router;
