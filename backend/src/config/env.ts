// Loads and validates backend environment variables.
import "dotenv/config";
import { z } from "zod";
import { durationToMilliseconds } from "../utils/duration.js";

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
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z
    .string({ required_error: "Missing required environment variable: JWT_SECRET" })
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: jwtExpirationSchema,
  COOKIE_NAME: z.string().min(1, "COOKIE_NAME must not be empty").default("school_token"),
});

export const env = envSchema.parse(process.env);
