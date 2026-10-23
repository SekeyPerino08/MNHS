// Combines API route modules under the main router.
import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);

export default apiRouter;
