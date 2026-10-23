import { Role } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createSectionController,
  deleteSectionController,
  getSectionController,
  listSectionsController,
  updateSectionController,
} from "./section.controller.js";
import { createSectionSchema, updateSectionSchema } from "./section.schema.js";

const router = Router();
router.use(authenticate);
router.get("/", authorize(Role.ADMIN, Role.TEACHER), listSectionsController);
router.get("/:id", authorize(Role.ADMIN, Role.TEACHER), getSectionController);
router.post("/", authorize(Role.ADMIN), validateBody(createSectionSchema), createSectionController);
router.patch("/:id", authorize(Role.ADMIN), validateBody(updateSectionSchema), updateSectionController);
router.delete("/:id", authorize(Role.ADMIN), deleteSectionController);
export default router;
