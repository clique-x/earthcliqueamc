import { and, db, desc, eq, ilike, inArray, or, quotes, requirementVendors, requirements, sql, vendorDocuments, vendorUsers, vendors } from "@amc/db";
import { PROJECT_CATEGORIES, REQUIREMENT_STATUSES, rfqConfigSchema, rfqReasonSchema, rfqRejectSchema, vendorSubscriptionSchema } from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { adminId, requireRole } from "../lib/auth";
import { getRfqConfig, setRfqConfig } from "../lib/config";
import { portalUrl, sendEmail } from "../lib/email";
import { conflict, notFound, parse } from "../lib/http";
import { findMatchingVendors, getRequirement, inviteVendors, notifyCompany, notifyVendor, requirementCode, scheduleExpiry, transitionRequirement, type Actor } from "../services/rfq";
import { requirementDetail, requirementSummary, vendorCard } from "../services/rfq-view";

const idParam = z.object({ id: z.uuid() });
const vendorQuery = z.object({ status: z.enum(["pending", "approved", "rejected", "suspended"]).optional(), q: z.string().trim().max(100).optional() });
const requirementQuery = z.object({ status: z.enum(REQUIREMENT_STATUSES).optional(), category: z.enum(PROJECT_CATEGORIES).optional(), q: z.string().trim().max(100).optional() });
const earthcliqueSchema = z.object({ isEarthclique: z.boolean() });

export async function adminRfqRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("admin"));

  const actorOf = (req: FastifyRequest): Actor => ({ type: "admin", id: adminId(req) });

  // ---- Vendors ----

  app.get("/admin/vendors", async (req) => {
    const { status, q } = parse(vendorQuery, req.query);
    const rows = await db.query.vendors.findMany({
      where: and(status ? eq(vendors.status, status) : undefined, q ? or(ilike(vendors.name, `%${q}%`), ilike(vendors.city, `%${q}%`), ilike(vendors.gstin, `%${q}%`)) : undefined),
      orderBy: desc(vendors.createdAt),
      limit: 500,
    });
    return rows.map((v) => ({
      ...vendorCard(v),
      gstin: v.gstin,
      status: v.status,
      categories: v.categories,
      states: v.states,
      subscriptionUntil: v.subscriptionUntil,
      subscribed: !!v.subscriptionUntil && v.subscriptionUntil > new Date(),
      lastActiveAt: v.lastActiveAt,
      createdAt: v.createdAt,
    }));
  });

  app.get("/admin/vendors/:id", async (req) => {
    const { id } = parse(idParam, req.params);
    const v = await db.query.vendors.findFirst({ where: eq(vendors.id, id) });
    if (!v) throw notFound("Vendor not found");
    const [users, docs, quoteRows] = await Promise.all([
      db.query.vendorUsers.findMany({ where: eq(vendorUsers.vendorId, id) }),
      db.query.vendorDocuments.findMany({ where: eq(vendorDocuments.vendorId, id), orderBy: desc(vendorDocuments.createdAt) }),
      db.query.quotes.findMany({ where: eq(quotes.vendorId, id), orderBy: desc(quotes.updatedAt), limit: 20 }),
    ]);
    const reqIds = quoteRows.map((q) => q.requirementId);
    const reqs = reqIds.length ? await db.query.requirements.findMany({ where: inArray(requirements.id, reqIds) }) : [];
    const reqById = new Map(reqs.map((r) => [r.id, r]));
    const [stats] = await db.execute<{ invited: number; quoted: number; won: number }>(sql`
      select
        (select count(*)::int from requirement_vendors where vendor_id = ${id}) as invited,
        (select count(*)::int from quotes where vendor_id = ${id} and status <> 'DRAFT') as quoted,
        (select count(*)::int from quotes where vendor_id = ${id} and status = 'AWARDED') as won
    `);
    return {
      ...vendorCard(v),
      gstin: v.gstin,
      status: v.status,
      rejectionReason: v.rejectionReason,
      categories: v.categories,
      states: v.states,
      description: v.description,
      website: v.website,
      subscriptionUntil: v.subscriptionUntil,
      subscribed: !!v.subscriptionUntil && v.subscriptionUntil > new Date(),
      lastActiveAt: v.lastActiveAt,
      createdAt: v.createdAt,
      users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role })),
      documents: docs.map((d) => ({ id: d.id, docType: d.docType, label: d.label, url: `/files/${d.fileKey}`, verified: !!d.verifiedAt, createdAt: d.createdAt })),
      stats: stats ?? { invited: 0, quoted: 0, won: 0 },
      quotes: quoteRows.map((q) => {
        const r = reqById.get(q.requirementId);
        return { id: q.id, requirementId: q.requirementId, code: r ? requirementCode(r) : null, title: r?.title ?? null, status: q.status, total: q.total, updatedAt: q.updatedAt };
      }),
    };
  });

  async function setVendorStatus(req: FastifyRequest, status: "approved" | "rejected" | "suspended", reason: string | null) {
    const { id } = parse(idParam, req.params);
    const current = await db.query.vendors.findFirst({ where: eq(vendors.id, id) });
    if (!current) throw notFound("Vendor not found");
    if (current.status === status) throw conflict(`Vendor is already ${status}`);
    if (status === "approved" && (await db.$count(vendorDocuments, eq(vendorDocuments.vendorId, id))) === 0) {
      throw conflict("The vendor hasn't uploaded any verification documents yet");
    }
    const [v] = await db.update(vendors).set({ status, rejectionReason: reason }).where(eq(vendors.id, id)).returning();
    if (!v) throw notFound("Vendor not found");
    if (status === "approved") await db.update(vendorDocuments).set({ verifiedAt: new Date(), verifiedBy: adminId(req) }).where(eq(vendorDocuments.vendorId, id));
    const users = await db.query.vendorUsers.findMany({ where: eq(vendorUsers.vendorId, id), columns: { email: true } });
    await sendEmail({
      to: users.map((u) => u.email),
      subject: { approved: "Your EarthClique vendor account is verified", rejected: "Your EarthClique vendor application", suspended: "Your EarthClique vendor account is suspended" }[status],
      text:
        status === "approved"
          ? `${v.name} is now verified. With an active subscription you'll receive matching project requirements.\n\n${portalUrl("/vendor")}`
          : `${v.name}: ${reason}\n\nContact EarthClique support if you have questions.`,
    });
    return { ok: true };
  }

  app.post("/admin/vendors/:id/approve", (req) => setVendorStatus(req, "approved", null));
  app.post("/admin/vendors/:id/reject", (req) => setVendorStatus(req, "rejected", parse(rfqRejectSchema, req.body).reason));
  app.post("/admin/vendors/:id/suspend", (req) => setVendorStatus(req, "suspended", parse(rfqRejectSchema, req.body).reason));

  /** Phase A: ops sets the subscription end date by hand. Razorpay replaces this in Phase B. */
  app.put("/admin/vendors/:id/subscription", async (req) => {
    const { id } = parse(idParam, req.params);
    const { subscriptionUntil } = parse(vendorSubscriptionSchema, req.body);
    const until = subscriptionUntil ? new Date(`${subscriptionUntil}T23:59:59+05:30`) : null;
    const [v] = await db.update(vendors).set({ subscriptionUntil: until }).where(eq(vendors.id, id)).returning();
    if (!v) throw notFound("Vendor not found");
    return { subscriptionUntil: v.subscriptionUntil };
  });

  app.put("/admin/vendors/:id/earthclique", async (req) => {
    const { id } = parse(idParam, req.params);
    const { isEarthclique } = parse(earthcliqueSchema, req.body);
    const [v] = await db.update(vendors).set({ isEarthclique }).where(eq(vendors.id, id)).returning();
    if (!v) throw notFound("Vendor not found");
    return { isEarthclique: v.isEarthclique };
  });

  // ---- Requirements ----

  app.get("/admin/projects", async (req) => {
    const { status, category, q } = parse(requirementQuery, req.query);
    const rows = await db
      .select({ r: requirements, companyName: sql<string>`(select name from companies c where c.id = ${requirements.companyId})` })
      .from(requirements)
      .where(
        and(
          status ? eq(requirements.status, status) : undefined,
          category ? eq(requirements.category, category) : undefined,
          q ? or(ilike(requirements.title, `%${q}%`), ilike(requirements.city, `%${q}%`), sql`'RQ-' || (10000 + ${requirements.number}) = upper(${q})`) : undefined,
        ),
      )
      .orderBy(desc(requirements.createdAt))
      .limit(300);
    const counts = await Promise.all(
      rows.map(async ({ r }) => ({
        invited: await db.$count(requirementVendors, eq(requirementVendors.requirementId, r.id)),
        quotes: await db.$count(quotes, and(eq(quotes.requirementId, r.id), sql`${quotes.status} <> 'DRAFT'`)),
      })),
    );
    return rows.map(({ r, companyName }, i) => ({ ...requirementSummary(r), companyName, ...counts[i] }));
  });

  app.get("/admin/projects/:id", async (req) => {
    const { id } = parse(idParam, req.params);
    return requirementDetail(id, { kind: "admin" });
  });

  /** Preview who would be invited, so ops can see why a requirement has few matches. */
  app.get("/admin/projects/:id/matches", async (req) => {
    const { id } = parse(idParam, req.params);
    const r = await getRequirement(id);
    const cfg = await getRfqConfig();
    return findMatchingVendors(r, cfg.maxInvites);
  });

  app.post("/admin/projects/:id/approve", async (req) => {
    const { id } = parse(idParam, req.params);
    const r = await transitionRequirement(id, "OPEN", actorOf(req), { set: { approvedAt: new Date() }, note: "Approved by ops" });
    const invited = await inviteVendors(r);
    await scheduleExpiry(r);
    await notifyCompany(
      r,
      { type: "requirement.updated", requirementId: r.id, status: "OPEN" },
      {
        subject: `${requirementCode(r)} is live: sent to ${invited} vendor${invited === 1 ? "" : "s"}`,
        text: `"${r.title}" has been approved and sent to ${invited} matching vendor${invited === 1 ? "" : "s"}. Quotes close ${r.quoteDeadline.toLocaleString("en-IN")}.\n\n${portalUrl(`/app/projects/${r.id}`)}`,
      },
    );
    return { ok: true, invited };
  });

  app.post("/admin/projects/:id/reject", async (req) => {
    const { id } = parse(idParam, req.params);
    const { reason } = parse(rfqRejectSchema, req.body);
    const r = await transitionRequirement(id, "REJECTED", actorOf(req), { set: { rejectionReason: reason, closedAt: new Date() }, note: reason });
    await notifyCompany(
      r,
      { type: "requirement.updated", requirementId: r.id, status: "REJECTED" },
      { subject: `${requirementCode(r)} was not approved`, text: `"${r.title}" was not approved:\n\n${reason}\n\nYou can edit the details and post it again.\n\n${portalUrl(`/app/projects/${r.id}`)}` },
    );
    return { ok: true };
  });

  app.post("/admin/projects/:id/cancel", async (req) => {
    const { id } = parse(idParam, req.params);
    const { reason } = parse(rfqReasonSchema, req.body ?? {});
    const r = await transitionRequirement(id, "CANCELLED", actorOf(req), { set: { closedAt: new Date() }, note: reason || "Cancelled by ops" });
    const invited = await db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id) });
    await Promise.all(invited.map((i) => notifyVendor(i.vendorId, { type: "requirement.updated", requirementId: r.id, status: "CANCELLED" })));
    return { ok: true };
  });

  /** Re-run matching for an open requirement, e.g. after approving new vendors. */
  app.post("/admin/projects/:id/reinvite", async (req) => {
    const { id } = parse(idParam, req.params);
    const r = await getRequirement(id);
    if (r.status !== "OPEN") throw conflict("Only open requirements can be re-sent");
    const invited = await inviteVendors(r);
    return { ok: true, invited };
  });

  app.get("/admin/rfq-config", async () => getRfqConfig());

  app.put("/admin/rfq-config", async (req) => {
    const value = parse(rfqConfigSchema, req.body);
    await setRfqConfig(value);
    return value;
  });
}
