// Loads and validates backend environment variables.
import "dotenv/config";
import { z } from "zod";

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
});

export const env = envSchema.parse(process.env);
