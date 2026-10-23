// Combines API route modules under the main router.
import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";
import studentRouter from "../modules/students/student.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/students", studentRouter);

export default apiRouter;
