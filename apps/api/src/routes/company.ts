import { and, companies, companyUsers, db, desc, engineers, eq, hashPassword, inArray, isNull, notInArray, ratings, sites, sql, ticketMedia, ticketParts, tickets } from "@amc/db";
import {
  companyUserCreateSchema,
  OPEN_STATUSES,
  ratingSchema,
  reasonSchema,
  siteCreateSchema,
  ticketCreateSchema,
} from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { companyUser, requireRole } from "../lib/auth";
import { getDispatchConfig } from "../lib/config";
import { pushToEngineer } from "../lib/events";
import { badRequest, conflict, forbidden, notFound, parse } from "../lib/http";
import { saveImage } from "../lib/storage";
import { startDispatch, withdrawOffers } from "../services/dispatch";
import { ticketDetail, ticketSummary } from "../services/ticket-view";
import { getTicket, logEvent, SYSTEM, transition, type Actor } from "../services/tickets";

const idParam = z.object({ id: z.uuid() });
const partParam = z.object({ id: z.uuid(), partId: z.uuid() });
const listQuery = z.object({ scope: z.enum(["open", "closed", "all"]).default("all") });

export async function companyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("company"));

  const actorOf = (req: FastifyRequest): Actor => ({ type: "company", id: companyUser(req).sub });

  async function ownTicket(req: FastifyRequest) {
    const { id } = parse(idParam, req.params);
    const t = await getTicket(id);
    if (t.companyId !== companyUser(req).companyId) throw notFound("Ticket not found");
    return t;
  }

  function requireCompanyAdmin(req: FastifyRequest) {
    if (companyUser(req).companyRole !== "admin") throw forbidden("Only company admins can do this");
  }

  app.get("/company/me", async (req) => {
    const u = companyUser(req);
    const [user, company] = await Promise.all([
      db.query.companyUsers.findFirst({ where: eq(companyUsers.id, u.sub) }),
      db.query.companies.findFirst({ where: eq(companies.id, u.companyId) }),
    ]);
    if (!user || !company) throw notFound();
    return { user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }, company };
  });

  app.get("/company/sites", async (req) => {
    const rows = await db.query.sites.findMany({ where: eq(sites.companyId, companyUser(req).companyId), orderBy: desc(sites.createdAt) });
    return rows.map((s) => ({ id: s.id, label: s.label, address: s.address, lat: s.location.lat, lng: s.location.lng, contactName: s.contactName, contactPhone: s.contactPhone }));
  });

  app.post("/company/sites", async (req) => {
    requireCompanyAdmin(req);
    const input = parse(siteCreateSchema, req.body);
    const [site] = await db
      .insert(sites)
      .values({
        companyId: companyUser(req).companyId,
        label: input.label,
        address: input.address,
        location: { lat: input.lat, lng: input.lng },
        contactName: input.contactName,
        contactPhone: input.contactPhone,
      })
      .returning();
    return { id: site!.id };
  });

  app.get("/company/users", async (req) => {
    const rows = await db.query.companyUsers.findMany({ where: eq(companyUsers.companyId, companyUser(req).companyId) });
    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role }));
  });

  app.post("/company/users", async (req) => {
    requireCompanyAdmin(req);
    const input = parse(companyUserCreateSchema, req.body);
    const taken = await db.query.companyUsers.findFirst({ where: sql`lower(${companyUsers.email}) = lower(${input.email})` });
    if (taken) throw conflict("An account with this email already exists");
    const [user] = await db
      .insert(companyUsers)
      .values({ companyId: companyUser(req).companyId, name: input.name, email: input.email, phone: input.phone, role: input.role, passwordHash: await hashPassword(input.password) })
      .returning();
    return { id: user!.id };
  });

  app.get("/company/tickets", async (req) => {
    const { scope } = parse(listQuery, req.query);
    const companyId = companyUser(req).companyId;
    const statusFilter =
      scope === "open" ? inArray(tickets.status, OPEN_STATUSES) : scope === "closed" ? notInArray(tickets.status, OPEN_STATUSES) : undefined;
    const rows = await db
      .select({ ticket: tickets, siteLabel: sites.label, engineerName: engineers.name })
      .from(tickets)
      .innerJoin(sites, eq(sites.id, tickets.siteId))
      .leftJoin(engineers, eq(engineers.id, tickets.engineerId))
      .where(and(eq(tickets.companyId, companyId), statusFilter))
      .orderBy(desc(tickets.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...ticketSummary(r.ticket), siteLabel: r.siteLabel, engineerName: r.engineerName }));
  });

  app.post("/company/tickets", async (req) => {
    const u = companyUser(req);
    const input = parse(ticketCreateSchema, req.body);
    const site = await db.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.companyId, u.companyId)) });
    if (!site) throw badRequest("Choose one of your sites");
    const cfg = await getDispatchConfig();
    const [t] = await db
      .insert(tickets)
      .values({
        companyId: u.companyId,
        siteId: site.id,
        raisedBy: u.sub,
        category: input.category,
        priority: input.priority,
        title: input.title,
        description: input.description,
        triage: input.triage,
        feeEstimate: cfg.fees[input.category],
      })
      .returning();
    await logEvent(t!.id, actorOf(req), "Ticket raised");
    await transition(t!.id, "SEARCHING", SYSTEM);
    await startDispatch(t!.id);
    return { id: t!.id };
  });

  app.get("/company/tickets/:id", async (req) => {
    const t = await ownTicket(req);
    return ticketDetail(t.id, "company");
  });

  app.post("/company/tickets/:id/media", async (req) => {
    const t = await ownTicket(req);
    const file = await req.file();
    if (!file) throw badRequest("Attach a photo");
    const key = await saveImage(await file.toBuffer(), file.mimetype, "tickets");
    await db.insert(ticketMedia).values({ ticketId: t.id, uploaderType: "company", uploaderId: companyUser(req).sub, kind: "issue", fileKey: key });
    await logEvent(t.id, actorOf(req), "Added a photo of the issue");
    return { ok: true };
  });

  app.post("/company/tickets/:id/cancel", async (req) => {
    const t = await ownTicket(req);
    const { reason } = parse(reasonSchema, req.body ?? {});
    await transition(t.id, "CANCELLED", actorOf(req), { note: reason || "Cancelled by company" });
    await withdrawOffers(t.id, "cancelled");
    if (t.engineerId) {
      const eng = await db.query.engineers.findFirst({ where: eq(engineers.id, t.engineerId), columns: { id: true, fcmToken: true } });
      if (eng) await pushToEngineer(eng, { type: "ticket.updated", ticketId: t.id, status: "CANCELLED" });
    }
    return { ok: true };
  });

  app.post("/company/tickets/:id/confirm", async (req) => {
    const t = await ownTicket(req);
    await transition(t.id, "CLOSED", actorOf(req), { set: { closedAt: new Date() }, note: "Confirmed fixed by company" });
    return { ok: true };
  });

  /** Company says it isn't fixed: back to work on site, or (after a remote fix) send someone on site. */
  app.post("/company/tickets/:id/reopen", async (req) => {
    const t = await ownTicket(req);
    const { reason } = parse(reasonSchema, req.body ?? {});
    if (t.status === "RESOLVED") {
      await transition(t.id, "IN_PROGRESS", actorOf(req), { set: { resolvedAt: null, closeOtp: null }, note: reason || "Company says the issue isn't fixed" });
    } else if (t.status === "REMOTE_RESOLVED") {
      await transition(t.id, "SEARCHING", actorOf(req), {
        set: { engineerId: null, resolvedAt: null, feeFinal: null, startOtp: null },
        note: reason || "Remote fix didn't work — requesting on-site visit",
      });
      await startDispatch(t.id);
    } else {
      throw conflict("Only resolved tickets can be reopened");
    }
    return { ok: true };
  });

  async function decidePart(req: FastifyRequest, approve: boolean) {
    const t = await ownTicket(req);
    const { partId } = parse(partParam, req.params);
    const now = new Date();
    const [part] = await db
      .update(ticketParts)
      .set(approve ? { approvedAt: now, approvedBy: companyUser(req).sub } : { rejectedAt: now })
      .where(and(eq(ticketParts.id, partId), eq(ticketParts.ticketId, t.id), eq(ticketParts.needsApproval, true), isNull(ticketParts.approvedAt), isNull(ticketParts.rejectedAt)))
      .returning();
    if (!part) throw conflict("This part has already been decided");
    await logEvent(t.id, actorOf(req), `${approve ? "Approved" : "Rejected"} part: ${part.name} × ${part.qty}`);
    return { ok: true };
  }

  app.post("/company/tickets/:id/parts/:partId/approve", (req) => decidePart(req, true));
  app.post("/company/tickets/:id/parts/:partId/reject", (req) => decidePart(req, false));

  app.post("/company/tickets/:id/rating", async (req) => {
    const t = await ownTicket(req);
    if (t.status !== "CLOSED" || !t.engineerId) throw conflict("You can rate after the ticket is closed");
    const input = parse(ratingSchema, req.body);
    const inserted = await db.insert(ratings).values({ ticketId: t.id, fromType: "company", score: input.score, comment: input.comment }).onConflictDoNothing().returning();
    if (inserted.length === 0) throw conflict("Already rated");
    await db
      .update(engineers)
      .set({
        ratingAvg: sql`(${engineers.ratingAvg} * ${engineers.ratingCount} + ${input.score}) / (${engineers.ratingCount} + 1)`,
        ratingCount: sql`${engineers.ratingCount} + 1`,
      })
      .where(eq(engineers.id, t.engineerId));
    return { ok: true };
  });
}

