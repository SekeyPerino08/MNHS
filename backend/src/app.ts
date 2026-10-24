// Creates and configures the Express application.
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { GLOBAL_RATE_LIMIT_PER_MINUTE } from "./config/limits.js";
import { env } from "./config/env.js";
import { apiHeaders } from "./middleware/apiHeaders.js";
import { csrfGuard } from "./middleware/csrfGuard.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { httpLogger } from "./lib/logger.js";
import { notFound } from "./middleware/notFound.js";
import { queryShape } from "./middleware/queryShape.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import apiRouter from "./routes/index.js";

const app = express();
const allowedOrigins = new Set(env.CORS_ORIGIN);

app.disable("x-powered-by");
// The deployed platform puts one proxy in front of the app; without this the rate limiters see its IP for every user.
app.set("trust proxy", env.TRUST_PROXY);
app.set("query parser", "simple");
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Request-Id"],
}));
app.use(apiHeaders);
app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: GLOBAL_RATE_LIMIT_PER_MINUTE,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.toLowerCase() === "/health",
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
      requestId: String(req.id),
    });
  },
}));
app.use("/api", csrfGuard);
app.use("/api", queryShape);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
