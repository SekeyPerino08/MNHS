// Loads and validates backend environment variables.
import "dotenv/config";
import { z } from "zod";
import { durationToMilliseconds } from "../utils/duration.js";

const corsOriginsSchema = z.string().default("http://localhost:3000").transform((value) => (
  value.split(",").map((origin) => origin.trim())
)).superRefine((origins, context) => {
  if (!origins.length || origins.some((origin) => !origin || origin.includes("*"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "CORS_ORIGIN must be a comma-separated list of exact origins" });
    return;
  }
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "CORS_ORIGIN entries must not contain paths or trailing slashes" });
      }
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "CORS_ORIGIN entries must be valid origins" });
    }
  }
});

const jwtExpirationSchema = z
  .string()
  .regex(/^\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|y)$/i, "JWT_EXPIRES_IN must be a valid duration such as 8h")
  .default("8h")
  .superRefine((value, context) => {
    let duration: number;
    try {
      duration = durationToMilliseconds(value);
    } catch {
      return;
    }
    if (duration > 2_147_483_647) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_EXPIRES_IN must not exceed the maximum supported cookie lifetime",
      });
    }
  });

const envSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "Missing required environment variable: DATABASE_URL" })
    .min(1, "Missing required environment variable: DATABASE_URL")
    .url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  DIRECT_URL: z
    .string({ required_error: "Missing required environment variable: DIRECT_URL" })
    .min(1, "Missing required environment variable: DIRECT_URL")
    .url("DIRECT_URL must be a valid PostgreSQL connection URL"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: corsOriginsSchema,
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z
    .string({ required_error: "Missing required environment variable: JWT_SECRET" })
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: jwtExpirationSchema,
  COOKIE_NAME: z.string().min(1, "COOKIE_NAME must not be empty").default("school_token"),
  COOKIE_SAMESITE: z.enum(["lax", "none"]).default("lax"),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") return;
  if (values.JWT_SECRET.length < 48 || /placeholder|replace|example|changeme|your[_ -]?secret/i.test(values.JWT_SECRET)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_SECRET"], message: "Production JWT_SECRET must be at least 48 characters and not a placeholder" });
  }
  if (values.CORS_ORIGIN.some((origin) => {
    try {
      return /localhost|127\.0\.0\.1/i.test(new URL(origin).hostname);
    } catch {
      return false;
    }
  })) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["CORS_ORIGIN"], message: "Production CORS_ORIGIN must not include localhost or 127.0.0.1" });
  }
  if (values.CORS_ORIGIN.some((origin) => !origin.startsWith("https://"))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["CORS_ORIGIN"], message: "Production CORS_ORIGIN entries must use https" });
  }
  if (new URL(values.DATABASE_URL).searchParams.get("sslmode") !== "require") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "Production DATABASE_URL must include sslmode=require" });
  }
});

export const env = envSchema.parse(process.env);
