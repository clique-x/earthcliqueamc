import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import { env, isDev } from "./env";
import { HttpError } from "./lib/http";
import { MAX_UPLOAD_BYTES } from "./lib/storage";
import { adminRoutes } from "./routes/admin";
import { adminRfqRoutes } from "./routes/admin-rfq";
import { authRoutes } from "./routes/auth";
import { companyRoutes } from "./routes/company";
import { companyProjectRoutes } from "./routes/company-projects";
import { engineerRoutes } from "./routes/engineer";
import { fileRoutes } from "./routes/files";
import { vendorRoutes } from "./routes/vendor";
import { wsRoutes } from "./routes/ws";

export async function buildApp() {
  const app = Fastify({
    logger: { level: isDev ? "info" : "warn" },
    trustProxy: true,
  });

  await app.register(cors, { origin: env.WEB_ORIGIN.split(","), credentials: true });
  await app.register(cookie);
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(websocket);

  // Treat an empty JSON body as "no body" so action endpoints work with clients that always send the header.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (body === "") return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }), undefined);
    }
  });

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const field = issue?.path.join(".");
      return reply.status(400).send({ error: "validation", message: field ? `${field}: ${issue?.message}` : issue?.message, issues: err.issues });
    }
    const status = "statusCode" in err && err.statusCode ? err.statusCode : 500;
    if (status < 500) return reply.status(status).send({ error: "code" in err ? err.code : "error", message: err.message });
    req.log.error(err);
    return reply.status(500).send({ error: "internal", message: "Something went wrong" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(companyRoutes);
  await app.register(engineerRoutes);
  await app.register(companyProjectRoutes);
  await app.register(vendorRoutes);
  await app.register(adminRoutes);
  await app.register(adminRfqRoutes);
  await app.register(fileRoutes);
  await app.register(wsRoutes);

  return app;
}
