import { and, db, desc, dispatchOffers, engineerKyc, engineers, eq, gt, gte, inArray, isNull, locationPings, ratings, sites, sql, ticketMedia, ticketParts, tickets } from "@amc/db";
import {
  engineerLocationSchema,
  engineerOnlineSchema,
  engineerProfileSchema,
  fcmTokenSchema,
  noteSchema,
  otpEntrySchema,
  partCreateSchema,
  ratingSchema,
  reasonSchema,
  type RingPayload,
} from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { engineerId, requireRole } from "../lib/auth";
import { getDispatchConfig } from "../lib/config";
import { channels, publish } from "../lib/events";
import { badRequest, conflict, forbidden, notFound, parse } from "../lib/http";
import { randomDigits } from "../lib/otp";
import { saveImage } from "../lib/storage";
import { acceptOffer, declineOffer, scheduleAutoClose, startDispatch } from "../services/dispatch";
import { computeFinalFee, ticketDetail, ticketSummary } from "../services/ticket-view";
import { getTicket, logEvent, ticketCode, transition, type Actor } from "../services/tickets";

const idParam = z.object({ id: z.uuid() });
const jobsQuery = z.object({ scope: z.enum(["active", "history"]).default("active") });
const mediaQuery = z.object({ kind: z.enum(["before", "after"]) });
const kycQuery = z.object({ docType: z.enum(["aadhaar", "pan", "selfie", "other"]) });

const ACTIVE = ["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "ON_HOLD"] as const;

function engineerProfile(e: typeof engineers.$inferSelect) {
  return {
    id: e.id,
    phone: e.phone,
    name: e.name,
    status: e.status,
    rejectionReason: e.rejectionReason,
    employmentType: e.employmentType,
    skills: e.skills,
    serviceRadiusKm: e.serviceRadiusKm,
    isOnline: e.isOnline,
    ratingAvg: Math.round(e.ratingAvg * 10) / 10,
    ratingCount: e.ratingCount,
    acceptanceRate: e.acceptanceRate,
    cooldownUntil: e.cooldownUntil,
    lastLocation: e.lastLocation,
  };
}

export async function engineerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("engineer"));

  const actorOf = (req: FastifyRequest): Actor => ({ type: "engineer", id: engineerId(req) });

  async function me(req: FastifyRequest) {
    const e = await db.query.engineers.findFirst({ where: eq(engineers.id, engineerId(req)) });
    if (!e) throw notFound("Account not found");
    return e;
  }

  /** A ticket currently or previously assigned to this engineer. */
  async function ownJob(req: FastifyRequest) {
    const { id } = parse(idParam, req.params);
    const t = await getTicket(id);
    if (t.engineerId !== engineerId(req)) throw notFound("Job not found");
    return t;
  }

  app.get("/engineer/me", async (req) => engineerProfile(await me(req)));

  app.patch("/engineer/me", async (req) => {
    const input = parse(engineerProfileSchema, req.body);
    const [e] = await db
      .update(engineers)
      .set({ name: input.name, skills: input.skills, serviceRadiusKm: input.serviceRadiusKm, employmentType: input.employmentType })
      .where(eq(engineers.id, engineerId(req)))
      .returning();
    return engineerProfile(e!);
  });

  app.get("/engineer/kyc", async (req) => {
    const docs = await db.query.engineerKyc.findMany({ where: eq(engineerKyc.engineerId, engineerId(req)) });
    return docs.map((d) => ({ id: d.id, docType: d.docType, verified: !!d.verifiedAt, createdAt: d.createdAt }));
  });

  app.post("/engineer/kyc", async (req) => {
    const { docType } = parse(kycQuery, req.query);
    const file = await req.file();
    if (!file) throw badRequest("Attach a photo of the document");
    const key = await saveImage(await file.toBuffer(), file.mimetype, "kyc");
    await db.insert(engineerKyc).values({ engineerId: engineerId(req), docType, fileKey: key });
    if (docType === "selfie") await db.update(engineers).set({ photoKey: key }).where(eq(engineers.id, engineerId(req)));
    return { ok: true };
  });

  app.post("/engineer/fcm-token", async (req) => {
    const { token } = parse(fcmTokenSchema, req.body);
    await db.update(engineers).set({ fcmToken: token }).where(eq(engineers.id, engineerId(req)));
    return { ok: true };
  });

  /** Called on sign-out so a phone that's no longer this engineer's stops receiving rings. */
  app.delete("/engineer/fcm-token", async (req) => {
    await db.update(engineers).set({ fcmToken: null }).where(eq(engineers.id, engineerId(req)));
    return { ok: true };
  });

  app.post("/engineer/online", async (req) => {
    const input = parse(engineerOnlineSchema, req.body);
    const e = await me(req);
    if (input.online && e.status !== "approved") throw forbidden("Your account is waiting for approval");
    const location = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
    const [updated] = await db
      .update(engineers)
      .set({ isOnline: input.online, lastSeenAt: new Date(), ...(location && { lastLocation: location }) })
      .where(eq(engineers.id, e.id))
      .returning();
    await publish([channels.admin], { type: "engineer.presence", engineerId: e.id, online: input.online, lat: location?.lat ?? null, lng: location?.lng ?? null });
    return engineerProfile(updated!);
  });

  /** Heartbeat while online (~60 s) and live tracking while travelling (~10 s). */
  app.post("/engineer/location", async (req) => {
    const loc = parse(engineerLocationSchema, req.body);
    const id = engineerId(req);
    const now = new Date();
    const active = await db.query.tickets.findFirst({
      where: and(eq(tickets.engineerId, id), inArray(tickets.status, [...ACTIVE])),
      columns: { id: true, status: true },
    });
    const [e] = await db
      .update(engineers)
      .set({ lastLocation: loc, lastSeenAt: now })
      .where(and(eq(engineers.id, id), active ? undefined : eq(engineers.isOnline, true)))
      .returning({ id: engineers.id });
    // Not online and no active job: we don't track location.
    if (!e) return { tracked: false };

    const ticketId = active?.id ?? null;
    const targets = [channels.admin];
    if (active && ["ASSIGNED", "EN_ROUTE", "ARRIVED"].includes(active.status)) {
      targets.push(channels.ticket(active.id));
      if (active.status === "EN_ROUTE") await db.insert(locationPings).values({ engineerId: id, ticketId: active.id, location: loc, recordedAt: now });
    }
    await publish(targets, { type: "engineer.location", engineerId: id, ticketId, lat: loc.lat, lng: loc.lng, at: now.toISOString() });
    return { tracked: true };
  });

  /** Rings still open for this engineer — used when the app is opened from a notification. */
  app.get("/engineer/offers/pending", async (req) => {
    const rows = await db
      .select({ offer: dispatchOffers, ticket: tickets })
      .from(dispatchOffers)
      .innerJoin(tickets, eq(tickets.id, dispatchOffers.ticketId))
      .where(and(eq(dispatchOffers.engineerId, engineerId(req)), isNull(dispatchOffers.response), gt(dispatchOffers.expiresAt, new Date()), eq(tickets.status, "SEARCHING")));
    return rows.map(
      ({ offer, ticket }): RingPayload => ({
        offerId: offer.id,
        ticketId: ticket.id,
        code: ticketCode(ticket),
        category: ticket.category,
        priority: ticket.priority,
        title: ticket.title,
        distanceKm: Math.round(offer.distanceKm * 10) / 10,
        feeEstimate: ticket.feeEstimate,
        expiresAt: offer.expiresAt.toISOString(),
        triage: ticket.triage,
      }),
    );
  });

  app.post("/engineer/offers/:id/accept", async (req) => {
    const { id } = parse(idParam, req.params);
    const t = await acceptOffer(id, engineerId(req));
    return { ticketId: t.id };
  });

  app.post("/engineer/offers/:id/decline", async (req) => {
    const { id } = parse(idParam, req.params);
    await declineOffer(id, engineerId(req));
    return { ok: true };
  });

  app.get("/engineer/jobs", async (req) => {
    const { scope } = parse(jobsQuery, req.query);
    const statusFilter = scope === "active" ? inArray(tickets.status, [...ACTIVE]) : sql`${tickets.status} not in ('ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','ON_HOLD')`;
    const rows = await db
      .select({ ticket: tickets, siteLabel: sites.label, siteAddress: sites.address })
      .from(tickets)
      .innerJoin(sites, eq(sites.id, tickets.siteId))
      .where(and(eq(tickets.engineerId, engineerId(req)), statusFilter))
      .orderBy(desc(tickets.assignedAt))
      .limit(100);
    return rows.map((r) => ({ ...ticketSummary(r.ticket), siteLabel: r.siteLabel, siteAddress: r.siteAddress }));
  });

  app.get("/engineer/jobs/:id", async (req) => {
    const t = await ownJob(req);
    return ticketDetail(t.id, "engineer");
  });

  app.post("/engineer/jobs/:id/start-journey", async (req) => {
    const t = await ownJob(req);
    await transition(t.id, "EN_ROUTE", actorOf(req));
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/arrive", { config: { rateLimit: { max: 10, timeWindow: "5 minutes" } } }, async (req) => {
    const t = await ownJob(req);
    const { otp } = parse(otpEntrySchema, req.body);
    if (t.status !== "EN_ROUTE") throw conflict("Start the journey first");
    if (otp !== t.startOtp) {
      await logEvent(t.id, actorOf(req), "Wrong start OTP entered");
      throw badRequest("Incorrect OTP — ask the site contact for the start code");
    }
    await transition(t.id, "ARRIVED", actorOf(req), { set: { arrivedAt: new Date() } });
    await transition(t.id, "IN_PROGRESS", actorOf(req));
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/hold", async (req) => {
    const t = await ownJob(req);
    const { reason } = parse(reasonSchema, req.body ?? {});
    await transition(t.id, "ON_HOLD", actorOf(req), { note: reason || "On hold" });
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/resume", async (req) => {
    const t = await ownJob(req);
    await transition(t.id, "IN_PROGRESS", actorOf(req), { note: "Work resumed" });
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/resolve", async (req) => {
    const t = await ownJob(req);
    const { note } = parse(noteSchema, req.body ?? {});
    const pending = await db.$count(ticketParts, and(eq(ticketParts.ticketId, t.id), eq(ticketParts.needsApproval, true), isNull(ticketParts.approvedAt), isNull(ticketParts.rejectedAt)));
    if (pending > 0) throw conflict("Some parts are still waiting for the company's approval");
    const updated = await transition(t.id, "RESOLVED", actorOf(req), {
      set: { resolvedAt: new Date(), closeOtp: randomDigits(4), feeFinal: await computeFinalFee(t) },
      note: note || "Work completed",
    });
    await scheduleAutoClose(updated);
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/remote-resolve", async (req) => {
    const t = await ownJob(req);
    const { note } = parse(noteSchema, req.body ?? {});
    const cfg = await getDispatchConfig();
    const updated = await transition(t.id, "REMOTE_RESOLVED", actorOf(req), {
      set: { resolvedAt: new Date(), feeFinal: cfg.fees.remote },
      note: note || "Fixed remotely",
    });
    await scheduleAutoClose(updated);
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/close", { config: { rateLimit: { max: 10, timeWindow: "5 minutes" } } }, async (req) => {
    const t = await ownJob(req);
    const { otp } = parse(otpEntrySchema, req.body);
    if (t.status !== "RESOLVED") throw conflict("Mark the work as done first");
    if (otp !== t.closeOtp) throw badRequest("Incorrect OTP — ask the site contact for the closing code");
    await transition(t.id, "CLOSED", actorOf(req), { set: { closedAt: new Date() }, note: "Closed with company OTP" });
    return { ok: true };
  });

  /** Engineer backs out after accepting: ticket goes back to dispatch; repeated cancels trigger a cooldown. */
  app.post("/engineer/jobs/:id/cancel", async (req) => {
    const t = await ownJob(req);
    const { reason } = parse(reasonSchema, req.body ?? {});
    const id = engineerId(req);
    await transition(t.id, "SEARCHING", actorOf(req), {
      set: { engineerId: null, assignedAt: null, startOtp: null },
      note: reason || "Engineer cancelled",
      meta: { engineerCancel: true },
    });
    await startDispatch(t.id);

    const cfg = await getDispatchConfig();
    const since = new Date(Date.now() - cfg.cancelCooldown.windowDays * 86400_000);
    const [row] = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from ticket_events
      where actor_type = 'engineer' and actor_id = ${id} and (meta->>'engineerCancel')::boolean and created_at >= ${since.toISOString()}
    `);
    if ((row?.n ?? 0) >= cfg.cancelCooldown.maxCancels) {
      await db
        .update(engineers)
        .set({ cooldownUntil: new Date(Date.now() + cfg.cancelCooldown.cooldownHours * 3600_000) })
        .where(eq(engineers.id, id));
    }
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/media", async (req) => {
    const t = await ownJob(req);
    const { kind } = parse(mediaQuery, req.query);
    const file = await req.file();
    if (!file) throw badRequest("Attach a photo");
    const key = await saveImage(await file.toBuffer(), file.mimetype, "tickets");
    await db.insert(ticketMedia).values({ ticketId: t.id, uploaderType: "engineer", uploaderId: engineerId(req), kind, fileKey: key });
    await logEvent(t.id, actorOf(req), `Added ${kind === "before" ? "a before" : "an after"} photo`);
    return { ok: true };
  });

  app.post("/engineer/jobs/:id/parts", async (req) => {
    const t = await ownJob(req);
    if (!["IN_PROGRESS", "ON_HOLD"].includes(t.status)) throw conflict("Parts can be added while work is in progress");
    const input = parse(partCreateSchema, req.body);
    const cfg = await getDispatchConfig();
    const needsApproval = input.qty * input.unitPrice > cfg.partsApprovalThreshold;
    await db.insert(ticketParts).values({ ticketId: t.id, name: input.name, qty: input.qty, unitPrice: input.unitPrice, needsApproval });
    await logEvent(t.id, actorOf(req), `Added part: ${input.name} × ${input.qty} (₹${input.qty * input.unitPrice})${needsApproval ? " — needs approval" : ""}`);
    return { needsApproval };
  });

  app.post("/engineer/jobs/:id/rating", async (req) => {
    const t = await ownJob(req);
    if (t.status !== "CLOSED") throw conflict("You can rate after the job is closed");
    const input = parse(ratingSchema, req.body);
    const inserted = await db.insert(ratings).values({ ticketId: t.id, fromType: "engineer", score: input.score, comment: input.comment }).onConflictDoNothing().returning();
    if (inserted.length === 0) throw conflict("Already rated");
    return { ok: true };
  });

  app.get("/engineer/earnings", async (req) => {
    const id = engineerId(req);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay.getTime() - ((startOfDay.getDay() + 6) % 7) * 86400_000);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const total = async (from: Date) => {
      const [row] = await db
        .select({ sum: sql<number>`coalesce(sum(${tickets.feeFinal}), 0)::int`, jobs: sql<number>`count(*)::int` })
        .from(tickets)
        .where(and(eq(tickets.engineerId, id), eq(tickets.status, "CLOSED"), gte(tickets.closedAt, from)));
      return row ?? { sum: 0, jobs: 0 };
    };
    const [today, week, month] = await Promise.all([total(startOfDay), total(startOfWeek), total(startOfMonth)]);
    return { today, week, month };
  });
}
