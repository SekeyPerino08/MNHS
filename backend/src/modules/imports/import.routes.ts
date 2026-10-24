import { Role } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { AppError } from "../../utils/AppError.js";
import {
  commitImportController,
  discardImportController,
  importHistoryController,
  importJobController,
  importRowsController,
  previewController,
  rejectedCsvController,
  templateController,
} from "./import.controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const uploadCsv: RequestHandler = (request, response, next) => {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(
        error.code === "LIMIT_FILE_SIZE" ? "CSV files must be 2 MB or smaller" : "Unable to accept the uploaded CSV file",
        error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
        error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
      ));
      return;
    }
    next(error);
  });
};

router.use(authenticate, authorize(Role.ADMIN));
router.get("/templates/:type", templateController);
router.post("/preview/:type", uploadCsv, previewController);
router.get("/jobs", importHistoryController);
router.get("/jobs/:id", importJobController);
router.get("/jobs/:id/rows", importRowsController);
router.get("/jobs/:id/rejected.csv", rejectedCsvController);
router.post("/jobs/:id/commit", commitImportController);
router.post("/jobs/:id/discard", discardImportController);

export default router;
