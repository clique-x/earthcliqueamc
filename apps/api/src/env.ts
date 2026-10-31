import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SMS_PROVIDER: z.enum(["console"]).default("console"),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
});

export const env = schema.parse(process.env);

export const isDev = env.NODE_ENV !== "production";
