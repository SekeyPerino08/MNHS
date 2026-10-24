// Combines API route modules under the main router.
import { Router } from "express";
import authRouter from "./auth.routes.js";
import healthRouter from "./health.routes.js";
import studentRouter from "../modules/students/student.routes.js";
import teacherRouter from "../modules/teachers/teacher.routes.js";
import subjectRouter from "../modules/subjects/subject.routes.js";
import schoolYearRouter from "../modules/school-years/school-year.routes.js";
import sectionRouter from "../modules/sections/section.routes.js";
import enrollmentRouter from "../modules/enrollments/enrollment.routes.js";
import classOfferingRouter from "../modules/class-offerings/class-offering.routes.js";
import meRouter from "../modules/me/me.routes.js";
import gradesRouter from "../modules/grades/grades.routes.js";
import reportCardsRouter from "../modules/report-cards/report-cards.routes.js";
import dashboardRouter from "../modules/dashboard/dashboard.routes.js";
import usersRouter from "../modules/users/user.routes.js";
import auditLogsRouter from "../modules/audit-logs/audit-log.routes.js";

const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use(gradesRouter);
apiRouter.use(reportCardsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/audit-logs", auditLogsRouter);
apiRouter.use("/students", studentRouter);
apiRouter.use("/teachers", teacherRouter);
apiRouter.use("/subjects", subjectRouter);
apiRouter.use("/school-years", schoolYearRouter);
apiRouter.use("/sections", sectionRouter);
apiRouter.use("/enrollments", enrollmentRouter);
apiRouter.use("/class-offerings", classOfferingRouter);
apiRouter.use("/me", meRouter);

export default apiRouter;
