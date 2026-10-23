// Combines API route modules under the main router.
import { Router } from "express";
import healthRouter from "./health.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);

export default apiRouter;
