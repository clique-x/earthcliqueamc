import { and, db, desc, eq, hashPassword, inArray, quotes, requirementQuestions, requirementVendors, requirements, sql, vendorDocuments, vendorUsers, vendors } from "@amc/db";
import { questionAskSchema, quoteSaveSchema, quoteSubmitSchema, VENDOR_DOC_TYPES, vendorProfileSchema, vendorUserCreateSchema } from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireRole, vendorUser } from "../lib/auth";
import { badRequest, conflict, forbidden, notFound, parse } from "../lib/http";
import { portalUrl } from "../lib/email";
import { saveDocument } from "../lib/storage";
import { getRequirement, logRequirementEvent, notifyCompany, requirementCode, saveQuoteDraft, submitQuote, withdrawQuote } from "../services/rfq";
import { quoteWithItems, requirementDetail, requirementSummary } from "../services/rfq-view";

const idParam = z.object({ id: z.uuid() });
const docQuery = z.object({ docType: z.enum(VENDOR_DOC_TYPES), label: z.string().trim().max(80).default("") });
const listQuery = z.object({ scope: z.enum(["open", "quoted", "closed", "all"]).default("open") });

function vendorProfile(v: typeof vendors.$inferSelect) {
  const subscribed = !!v.subscriptionUntil && v.subscriptionUntil > new Date();
  return {
    id: v.id,
    name: v.name,
    gstin: v.gstin,
    status: v.status,
    rejectionReason: v.rejectionReason,
    categories: v.categories,
    states: v.states,
    city: v.city,
    description: v.description,
    website: v.website,
    certifications: v.certifications,
    teamSize: v.teamSize,
    foundedYear: v.foundedYear,
    subscriptionUntil: v.subscriptionUntil,
    subscribed,
    ratingAvg: Math.round(v.ratingAvg * 10) / 10,
    ratingCount: v.ratingCount,
    createdAt: v.createdAt,
  };
}

export async function vendorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("vendor"));

  async function me(req: FastifyRequest) {
    const v = await db.query.vendors.findFirst({ where: eq(vendors.id, vendorUser(req).vendorId) });
    if (!v) throw notFound("Vendor not found");
    return v;
  }

  function requireVendorAdmin(req: FastifyRequest) {
    if (vendorUser(req).vendorRole !== "admin") throw forbidden("Only vendor admins can do this");
  }

  /** A requirement this vendor was invited to. */
  async function invitedRequirement(req: FastifyRequest) {
    const { id } = parse(idParam, req.params);
    const r = await getRequirement(id);
    const invite = await db.query.requirementVendors.findFirst({
      where: and(eq(requirementVendors.requirementId, r.id), eq(requirementVendors.vendorId, vendorUser(req).vendorId)),
    });
    if (!invite) throw notFound("Requirement not found");
    return r;
  }

  app.get("/vendor/me", async (req) => {
    const u = vendorUser(req);
    const [v, user] = await Promise.all([me(req), db.query.vendorUsers.findFirst({ where: eq(vendorUsers.id, u.sub) })]);
    if (!user) throw notFound();
    return { vendor: vendorProfile(v), user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
  });

  app.patch("/vendor/me", async (req) => {
    requireVendorAdmin(req);
    const input = parse(vendorProfileSchema, req.body);
    const [v] = await db.update(vendors).set(input).where(eq(vendors.id, vendorUser(req).vendorId)).returning();
    return vendorProfile(v!);
  });

  app.get("/vendor/documents", async (req) => {
    const docs = await db.query.vendorDocuments.findMany({ where: eq(vendorDocuments.vendorId, vendorUser(req).vendorId), orderBy: desc(vendorDocuments.createdAt) });
    return docs.map((d) => ({ id: d.id, docType: d.docType, label: d.label, url: `/files/${d.fileKey}`, verified: !!d.verifiedAt, createdAt: d.createdAt }));
  });

  app.post("/vendor/documents", async (req) => {
    requireVendorAdmin(req);
    const { docType, label } = parse(docQuery, req.query);
    const file = await req.file();
    if (!file) throw badRequest("Attach the document");
    const key = await saveDocument(await file.toBuffer(), file.mimetype, "vendor");
    await db.insert(vendorDocuments).values({ vendorId: vendorUser(req).vendorId, docType, label, fileKey: key });
    return { ok: true };
  });

  app.get("/vendor/users", async (req) => {
    const rows = await db.query.vendorUsers.findMany({ where: eq(vendorUsers.vendorId, vendorUser(req).vendorId) });
    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role }));
  });

  app.post("/vendor/users", async (req) => {
    requireVendorAdmin(req);
    const input = parse(vendorUserCreateSchema, req.body);
    const taken = await db.query.vendorUsers.findFirst({ where: sql`lower(${vendorUsers.email}) = lower(${input.email})` });
    if (taken) throw conflict("An account with this email already exists");
    const [u] = await db
      .insert(vendorUsers)
      .values({ vendorId: vendorUser(req).vendorId, name: input.name, email: input.email, phone: input.phone, role: input.role, passwordHash: await hashPassword(input.password) })
      .returning();
    return { id: u!.id };
  });

  /** Requirements sent to this vendor, with the state of their own quote. */
  app.get("/vendor/requirements", async (req) => {
    const { scope } = parse(listQuery, req.query);
    const vendorId = vendorUser(req).vendorId;
    const rows = await db.execute<{
      requirement: string;
      quote_status: string | null;
      quote_total: number | null;
      quote_updated_at: string | null;
      declined_at: string | null;
      viewed_at: string | null;
    }>(sql`
      select r.id as requirement, q.status as quote_status, q.total as quote_total, q.updated_at as quote_updated_at, rv.declined_at, rv.viewed_at
      from requirement_vendors rv
      join requirements r on r.id = rv.requirement_id
      left join quotes q on q.requirement_id = r.id and q.vendor_id = rv.vendor_id
      where rv.vendor_id = ${vendorId}
      order by rv.invited_at desc
      limit 300
    `);
    const ids = rows.map((x) => x.requirement);
    const reqs = ids.length ? await db.query.requirements.findMany({ where: inArray(requirements.id, ids) }) : [];
    const byId = new Map(reqs.map((r) => [r.id, r]));
    return rows
      .map((x) => {
        const r = byId.get(x.requirement);
        if (!r) return null;
        const item = {
          ...requirementSummary(r),
          deadlinePassed: r.quoteDeadline < new Date(),
          myQuoteStatus: x.quote_status,
          myQuoteTotal: x.quote_total,
          myQuoteUpdatedAt: x.quote_updated_at,
          declined: !!x.declined_at,
          viewed: !!x.viewed_at,
        };
        const open = r.status === "OPEN" && !item.deadlinePassed;
        const quoted = !!x.quote_status && x.quote_status !== "DRAFT" && x.quote_status !== "WITHDRAWN";
        if (scope === "open") return open && !item.declined ? item : null;
        if (scope === "quoted") return quoted ? item : null;
        if (scope === "closed") return !open || item.declined ? item : null;
        return item;
      })
      .filter((x) => x !== null);
  });

  app.get("/vendor/requirements/:id", async (req) => {
    const r = await invitedRequirement(req);
    const vendorId = vendorUser(req).vendorId;
    await db
      .update(requirementVendors)
      .set({ viewedAt: new Date() })
      .where(and(eq(requirementVendors.requirementId, r.id), eq(requirementVendors.vendorId, vendorId), sql`${requirementVendors.viewedAt} is null`));
    return requirementDetail(r.id, { kind: "vendor", vendorId });
  });

  app.post("/vendor/requirements/:id/decline", async (req) => {
    const r = await invitedRequirement(req);
    const vendorId = vendorUser(req).vendorId;
    const q = await db.query.quotes.findFirst({ where: and(eq(quotes.requirementId, r.id), eq(quotes.vendorId, vendorId)) });
    if (q && q.status !== "DRAFT" && q.status !== "WITHDRAWN") throw conflict("Withdraw your quote first");
    await db
      .update(requirementVendors)
      .set({ declinedAt: new Date() })
      .where(and(eq(requirementVendors.requirementId, r.id), eq(requirementVendors.vendorId, vendorUser(req).vendorId)));
    return { ok: true };
  });

  app.post("/vendor/requirements/:id/questions", async (req) => {
    const r = await invitedRequirement(req);
    if (r.status !== "OPEN") throw conflict("This requirement is no longer open for questions");
    const { question } = parse(questionAskSchema, req.body);
    const v = await me(req);
    const [q] = await db.insert(requirementQuestions).values({ requirementId: r.id, vendorId: v.id, question }).returning();
    await logRequirementEvent(r.id, { type: "vendor", id: v.id }, `${v.name} asked a question`);
    await notifyCompany(
      r,
      { type: "requirement.question", requirementId: r.id, questionId: q!.id, answered: false },
      { subject: `Question on ${requirementCode(r)}: ${r.title}`, text: `A vendor asked:\n\n"${question}"\n\nYour answer will be visible to every invited vendor.\n\nAnswer: ${portalUrl(`/app/projects/${r.id}`)}` },
    );
    return { id: q!.id };
  });

  app.get("/vendor/requirements/:id/quote", async (req) => {
    const r = await invitedRequirement(req);
    const detail = await requirementDetail(r.id, { kind: "vendor", vendorId: vendorUser(req).vendorId });
    return detail.myQuote;
  });

  app.put("/vendor/requirements/:id/quote", async (req) => {
    const r = await invitedRequirement(req);
    const input = parse(quoteSaveSchema, req.body);
    const q = await saveQuoteDraft(vendorUser(req).vendorId, r, input);
    return quoteWithItems(q);
  });

  app.post("/vendor/requirements/:id/quote/submit", async (req) => {
    const r = await invitedRequirement(req);
    const input = parse(quoteSubmitSchema, req.body);
    const q = await submitQuote(vendorUser(req).vendorId, r, input);
    return quoteWithItems(q);
  });

  app.post("/vendor/requirements/:id/quote/withdraw", async (req) => {
    const r = await invitedRequirement(req);
    const q = await withdrawQuote(vendorUser(req).vendorId, r);
    return quoteWithItems(q);
  });
}
