import { and, db, engineerKyc, eq, requirementAttachments, requirementVendors, requirements, ticketMedia, tickets, vendorDocuments } from "@amc/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, type AuthUser } from "../lib/auth";
import { notFound, parse } from "../lib/http";
import { openFile } from "../lib/storage";

const params = z.object({ folder: z.enum(["tickets", "kyc", "rfq", "vendor"]), name: z.string().max(64) });
const query = z.object({ as: z.enum(["engineer", "company", "vendor", "admin"]).default("engineer") });

async function canRead(user: AuthUser, folder: "tickets" | "kyc" | "rfq" | "vendor", key: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (folder === "vendor") {
    const doc = await db.query.vendorDocuments.findFirst({ where: eq(vendorDocuments.fileKey, key) });
    return user.role === "vendor" && doc?.vendorId === user.vendorId;
  }
  if (folder === "rfq") {
    const att = await db.query.requirementAttachments.findFirst({ where: eq(requirementAttachments.fileKey, key) });
    if (!att) return false;
    const r = await db.query.requirements.findFirst({ where: eq(requirements.id, att.requirementId), columns: { companyId: true } });
    if (user.role === "company") return r?.companyId === user.companyId;
    if (user.role !== "vendor") return false;
    const invite = await db.query.requirementVendors.findFirst({
      where: and(eq(requirementVendors.requirementId, att.requirementId), eq(requirementVendors.vendorId, user.vendorId)),
    });
    return !!invite;
  }
  if (folder === "kyc") {
    const doc = await db.query.engineerKyc.findFirst({ where: eq(engineerKyc.fileKey, key) });
    return user.role === "engineer" && doc?.engineerId === user.sub;
  }
  const media = await db.query.ticketMedia.findFirst({ where: eq(ticketMedia.fileKey, key) });
  if (!media) return false;
  const t = await db.query.tickets.findFirst({ where: eq(tickets.id, media.ticketId), columns: { companyId: true, engineerId: true } });
  if (user.role === "company") return t?.companyId === user.companyId;
  if (user.role === "vendor") return false;
  return t?.engineerId === user.sub;
}

export async function fileRoutes(app: FastifyInstance) {
  app.get("/files/:folder/:name", async (req, reply) => {
    const { folder, name } = parse(params, req.params);
    const { as } = parse(query, req.query);
    const user = authenticate(req, as);
    const key = `${folder}/${name}`;
    // Respond 404 for both "missing" and "not yours" so keys can't be probed.
    if (!(await canRead(user, folder, key))) throw notFound();
    const file = await openFile(key);
    if (!file) throw notFound();
    return reply.header("Content-Type", file.contentType).header("Cache-Control", "private, max-age=3600").send(file.stream);
  });
}
