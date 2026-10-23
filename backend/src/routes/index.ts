// Combines API route modules under the main router.
import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";
import studentRouter from "../modules/students/student.routes.js";
import teacherRouter from "../modules/teachers/teacher.routes.js";
import subjectRouter from "../modules/subjects/subject.routes.js";
import schoolYearRouter from "../modules/school-years/school-year.routes.js";
import sectionRouter from "../modules/sections/section.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/students", studentRouter);
apiRouter.use("/teachers", teacherRouter);
apiRouter.use("/subjects", subjectRouter);
apiRouter.use("/school-years", schoolYearRouter);
apiRouter.use("/sections", sectionRouter);

export default apiRouter;
