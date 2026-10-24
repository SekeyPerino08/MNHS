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
  studentTemplateController,
  teacherTemplateController,
} from "./import.controller.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const uploadCsv: RequestHandler = (request, response, next) => {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      next(new AppError(
        tooLarge ? "CSV files must be 2 MB or smaller" : "Unable to accept the uploaded CSV file",
        tooLarge ? 413 : 400,
        tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
      ));
      return;
    }
    next(error);
  });
};

router.use(authenticate, authorize(Role.ADMIN));
router.get("/templates/students.csv", studentTemplateController);
router.get("/templates/teachers.csv", teacherTemplateController);
router.post("/preview", uploadCsv, previewController);
router.get("/", importHistoryController);
router.get("/:id/rows", importRowsController);
router.get("/:id/rejected.csv", rejectedCsvController);
router.post("/:id/commit", commitImportController);
router.post("/:id/discard", discardImportController);
router.get("/:id", importJobController);

export default router;
