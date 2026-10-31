import { and, companies, db, desc, engineerKyc, engineers, eq, ilike, inArray, isNotNull, notInArray, or, sites, sql, tickets } from "@amc/db";
import { adminAssignSchema, adminRejectSchema, dispatchConfigSchema, OPEN_STATUSES, reasonSchema, TICKET_STATUSES } from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { adminId, requireRole } from "../lib/auth";
import { getDispatchConfig, setDispatchConfig } from "../lib/config";
import { pushToEngineer } from "../lib/events";
import { conflict, notFound, parse } from "../lib/http";
import { assignByAdmin, startDispatch, withdrawOffers } from "../services/dispatch";
import { ticketDetail, ticketSummary } from "../services/ticket-view";
import { getTicket, transition, type Actor } from "../services/tickets";

const idParam = z.object({ id: z.uuid() });
const engineerQuery = z.object({ status: z.enum(["pending", "approved", "rejected", "suspended"]).optional() });
const ticketQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  scope: z.enum(["open", "closed", "all"]).default("all"),
  q: z.string().trim().max(100).optional(),
});

const ACTIVE_ON_MAP = ["SEARCHING", "UNASSIGNED", "ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "ON_HOLD"] as const;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("admin"));

  const actorOf = (req: FastifyRequest): Actor => ({ type: "admin", id: adminId(req) });

  app.get("/admin/me", async (req) => {
    const admin = await db.query.admins.findFirst({ where: (a, { eq }) => eq(a.id, adminId(req)) });
    if (!admin) throw notFound();
    return { id: admin.id, name: admin.name, email: admin.email };
  });

  app.get("/admin/engineers", async (req) => {
    const { status } = parse(engineerQuery, req.query);
    const rows = await db.query.engineers.findMany({
      where: status ? eq(engineers.status, status) : undefined,
      orderBy: desc(engineers.createdAt),
      limit: 500,
    });
    return rows.map((e) => ({
      id: e.id,
      name: e.name,
      phone: e.phone,
      status: e.status,
      employmentType: e.employmentType,
      skills: e.skills,
      isOnline: e.isOnline,
      ratingAvg: Math.round(e.ratingAvg * 10) / 10,
      ratingCount: e.ratingCount,
      acceptanceRate: e.acceptanceRate,
      cooldownUntil: e.cooldownUntil,
      lastSeenAt: e.lastSeenAt,
      createdAt: e.createdAt,
    }));
  });

  app.get("/admin/engineers/:id", async (req) => {
    const { id } = parse(idParam, req.params);
    const e = await db.query.engineers.findFirst({ where: eq(engineers.id, id) });
    if (!e) throw notFound("Engineer not found");
    const [kyc, jobs] = await Promise.all([
      db.query.engineerKyc.findMany({ where: eq(engineerKyc.engineerId, id), orderBy: desc(engineerKyc.createdAt) }),
      db.query.tickets.findMany({ where: eq(tickets.engineerId, id), orderBy: desc(tickets.assignedAt), limit: 20 }),
    ]);
    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      status: e.status,
      rejectionReason: e.rejectionReason,
      employmentType: e.employmentType,
      skills: e.skills,
      serviceRadiusKm: e.serviceRadiusKm,
      isOnline: e.isOnline,
      lastLocation: e.lastLocation,
      lastSeenAt: e.lastSeenAt,
      ratingAvg: Math.round(e.ratingAvg * 10) / 10,
      ratingCount: e.ratingCount,
      acceptanceRate: e.acceptanceRate,
      cooldownUntil: e.cooldownUntil,
      createdAt: e.createdAt,
      kyc: kyc.map((d) => ({ id: d.id, docType: d.docType, url: `/files/${d.fileKey}`, verified: !!d.verifiedAt, createdAt: d.createdAt })),
      jobs: jobs.map(ticketSummary),
    };
  });

  app.post("/admin/engineers/:id/approve", async (req) => {
    const { id } = parse(idParam, req.params);
    const [e] = await db.update(engineers).set({ status: "approved", rejectionReason: null }).where(eq(engineers.id, id)).returning();
    if (!e) throw notFound("Engineer not found");
    await db.update(engineerKyc).set({ verifiedAt: new Date(), verifiedBy: adminId(req) }).where(eq(engineerKyc.engineerId, id));
    return { ok: true };
  });

  app.post("/admin/engineers/:id/reject", async (req) => {
    const { id } = parse(idParam, req.params);
    const { reason } = parse(adminRejectSchema, req.body);
    const [e] = await db.update(engineers).set({ status: "rejected", rejectionReason: reason, isOnline: false }).where(eq(engineers.id, id)).returning();
    if (!e) throw notFound("Engineer not found");
    return { ok: true };
  });

  app.post("/admin/engineers/:id/suspend", async (req) => {
    const { id } = parse(idParam, req.params);
    const { reason } = parse(adminRejectSchema, req.body);
    const [e] = await db.update(engineers).set({ status: "suspended", rejectionReason: reason, isOnline: false }).where(eq(engineers.id, id)).returning();
    if (!e) throw notFound("Engineer not found");
    return { ok: true };
  });

  /** Snapshot for the live map: online engineers and active tickets. */
  app.get("/admin/live", async () => {
    const [onlineEngineers, activeTickets] = await Promise.all([
      db.query.engineers.findMany({ where: and(eq(engineers.isOnline, true), isNotNull(engineers.lastLocation)) }),
      db
        .select({ ticket: tickets, site: sites, companyName: companies.name })
        .from(tickets)
        .innerJoin(sites, eq(sites.id, tickets.siteId))
        .innerJoin(companies, eq(companies.id, tickets.companyId))
        .where(inArray(tickets.status, [...ACTIVE_ON_MAP]))
        .orderBy(desc(tickets.createdAt)),
    ]);
    const busy = new Map(activeTickets.filter((r) => r.ticket.engineerId).map((r) => [r.ticket.engineerId!, r.ticket.id]));
    return {
      engineers: onlineEngineers.map((e) => ({
        id: e.id,
        name: e.name,
        skills: e.skills,
        lat: e.lastLocation!.lat,
        lng: e.lastLocation!.lng,
        lastSeenAt: e.lastSeenAt,
        activeTicketId: busy.get(e.id) ?? null,
      })),
      tickets: activeTickets.map((r) => ({
        ...ticketSummary(r.ticket),
        companyName: r.companyName,
        siteLabel: r.site.label,
        lat: r.site.location.lat,
        lng: r.site.location.lng,
        engineerId: r.ticket.engineerId,
      })),
    };
  });

  app.get("/admin/tickets", async (req) => {
    const { status, scope, q } = parse(ticketQuery, req.query);
    const filters = [
      status ? eq(tickets.status, status) : undefined,
      scope === "open" ? inArray(tickets.status, OPEN_STATUSES) : scope === "closed" ? notInArray(tickets.status, OPEN_STATUSES) : undefined,
      q ? or(ilike(tickets.title, `%${q}%`), ilike(companies.name, `%${q}%`), sql`'EC-' || (10000 + ${tickets.number}) = upper(${q})`) : undefined,
    ];
    const rows = await db
      .select({ ticket: tickets, companyName: companies.name, siteLabel: sites.label, engineerName: engineers.name })
      .from(tickets)
      .innerJoin(companies, eq(companies.id, tickets.companyId))
      .innerJoin(sites, eq(sites.id, tickets.siteId))
      .leftJoin(engineers, eq(engineers.id, tickets.engineerId))
      .where(and(...filters))
      .orderBy(desc(tickets.createdAt))
      .limit(200);
    return rows.map((r) => ({ ...ticketSummary(r.ticket), companyName: r.companyName, siteLabel: r.siteLabel, engineerName: r.engineerName, paid: r.ticket.paid }));
  });

  app.get("/admin/tickets/:id", async (req) => {
    const { id } = parse(idParam, req.params);
    return ticketDetail(id, "admin");
  });

  /** Engineers who could be assigned manually, nearest first. */
  app.get("/admin/tickets/:id/candidates", async (req) => {
    const { id } = parse(idParam, req.params);
    const t = await getTicket(id);
    const rows = await db.execute<{ id: string; name: string; phone: string; is_online: boolean; km: number | null; busy: boolean }>(sql`
      select e.id, e.name, e.phone, e.is_online,
        case when e.last_location is null then null else ST_Distance(e.last_location, s.location) / 1000 end as km,
        exists (select 1 from tickets b where b.engineer_id = e.id and b.status in ('ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS')) as busy
      from engineers e join sites s on s.id = ${t.siteId}
      where e.status = 'approved' and ${t.category}::category = any(e.skills)
      order by e.is_online desc, km asc nulls last
      limit 50
    `);
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, isOnline: r.is_online, distanceKm: r.km === null ? null : Math.round(Number(r.km) * 10) / 10, busy: r.busy }));
  });

  app.post("/admin/tickets/:id/assign", async (req) => {
    const { id } = parse(idParam, req.params);
    const { engineerId } = parse(adminAssignSchema, req.body);
    await assignByAdmin(id, engineerId, adminId(req));
    return { ok: true };
  });

  app.post("/admin/tickets/:id/redispatch", async (req) => {
    const { id } = parse(idParam, req.params);
    const t = await getTicket(id);
    if (!["UNASSIGNED", "ASSIGNED", "EN_ROUTE"].includes(t.status)) throw conflict("Only unassigned or not-yet-arrived tickets can be re-dispatched");
    const previous = t.engineerId;
    await transition(id, "SEARCHING", actorOf(req), { set: { engineerId: null, assignedAt: null, startOtp: null }, note: "Re-dispatched by ops" });
    await startDispatch(id);
    if (previous) {
      const eng = await db.query.engineers.findFirst({ where: eq(engineers.id, previous), columns: { id: true, fcmToken: true } });
      if (eng) await pushToEngineer(eng, { type: "ticket.updated", ticketId: id, status: "SEARCHING" });
    }
    return { ok: true };
  });

  app.post("/admin/tickets/:id/cancel", async (req) => {
    const { id } = parse(idParam, req.params);
    const { reason } = parse(reasonSchema, req.body ?? {});
    const t = await transition(id, "CANCELLED", actorOf(req), { note: reason || "Cancelled by ops" });
    await withdrawOffers(id, "cancelled");
    if (t.engineerId) {
      const eng = await db.query.engineers.findFirst({ where: eq(engineers.id, t.engineerId), columns: { id: true, fcmToken: true } });
      if (eng) await pushToEngineer(eng, { type: "ticket.updated", ticketId: id, status: "CANCELLED" });
    }
    return { ok: true };
  });

  app.post("/admin/tickets/:id/close", async (req) => {
    const { id } = parse(idParam, req.params);
    await transition(id, "CLOSED", actorOf(req), { set: { closedAt: new Date() }, note: "Closed by ops" });
    return { ok: true };
  });

  app.post("/admin/tickets/:id/mark-paid", async (req) => {
    const { id } = parse(idParam, req.params);
    const [t] = await db.update(tickets).set({ paid: true }).where(and(eq(tickets.id, id), eq(tickets.status, "CLOSED"))).returning();
    if (!t) throw conflict("Only closed tickets can be marked paid");
    return { ok: true };
  });

  app.get("/admin/dispatch-config", async () => getDispatchConfig());

  app.put("/admin/dispatch-config", async (req) => {
    const value = parse(dispatchConfigSchema, req.body);
    await setDispatchConfig(value);
    return value;
  });

  app.get("/admin/companies", async () => {
    const rows = await db.execute<{ id: string; name: string; gstin: string | null; created_at: string; sites: number; tickets: number }>(sql`
      select c.id, c.name, c.gstin, c.created_at,
        (select count(*)::int from sites s where s.company_id = c.id) as sites,
        (select count(*)::int from tickets t where t.company_id = c.id) as tickets
      from companies c order by c.created_at desc limit 500
    `);
    return rows.map((r) => ({ id: r.id, name: r.name, gstin: r.gstin, createdAt: r.created_at, sites: r.sites, tickets: r.tickets }));
  });

  app.get("/admin/stats", async () => {
    const [row] = await db.execute<{
      today: number;
      open: number;
      unassigned: number;
      online: number;
      pending_engineers: number;
      avg_accept_min: number | null;
      avg_resolve_min: number | null;
    }>(sql`
      select
        (select count(*)::int from tickets where created_at >= date_trunc('day', now())) as today,
        (select count(*)::int from tickets where status in ('SEARCHING','ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','ON_HOLD')) as open,
        (select count(*)::int from tickets where status = 'UNASSIGNED') as unassigned,
        (select count(*)::int from engineers where is_online) as online,
        (select count(*)::int from engineers where status = 'pending') as pending_engineers,
        (select avg(extract(epoch from assigned_at - created_at) / 60)::float8 from tickets where assigned_at is not null and created_at > now() - interval '30 days') as avg_accept_min,
        (select avg(extract(epoch from resolved_at - created_at) / 60)::float8 from tickets where resolved_at is not null and created_at > now() - interval '30 days') as avg_resolve_min
    `);
    return {
      ticketsToday: row?.today ?? 0,
      openTickets: row?.open ?? 0,
      unassignedTickets: row?.unassigned ?? 0,
      onlineEngineers: row?.online ?? 0,
      pendingEngineers: row?.pending_engineers ?? 0,
      avgMinutesToAccept: row?.avg_accept_min === null || row?.avg_accept_min === undefined ? null : Math.round(Number(row.avg_accept_min) * 10) / 10,
      avgMinutesToResolve: row?.avg_resolve_min === null || row?.avg_resolve_min === undefined ? null : Math.round(Number(row.avg_resolve_min)),
    };
  });
}
