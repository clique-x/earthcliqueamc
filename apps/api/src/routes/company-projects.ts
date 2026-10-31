import { and, db, desc, eq, requirementAttachments, requirementQuestions, requirementVendors, requirements, sites } from "@amc/db";
import { INDIAN_STATES, questionAnswerSchema, requirementCreateSchema, revisionRequestSchema, rfqReasonSchema, validateSpec } from "@amc/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { companyUser, requireRole } from "../lib/auth";
import { getRfqConfig } from "../lib/config";
import { badRequest, conflict, notFound, parse } from "../lib/http";
import { saveDocument } from "../lib/storage";
import { decideQuote, getRequirement, logRequirementEvent, notifyVendor, requirementCode, transitionRequirement, type Actor } from "../services/rfq";
import { requirementDetail, requirementSummary } from "../services/rfq-view";
import { channels, publish } from "../lib/events";

const idParam = z.object({ id: z.uuid() });
const questionParam = z.object({ id: z.uuid(), questionId: z.uuid() });
const quoteParam = z.object({ id: z.uuid(), quoteId: z.uuid() });
const listQuery = z.object({ scope: z.enum(["open", "closed", "all"]).default("all") });
const attachmentQuery = z.object({ name: z.string().trim().min(1).max(120).default("Attachment") });

const OPEN = ["SUBMITTED", "OPEN"] as const;

/** Guess the state from a free-text address so matching works without geocoding. */
function stateFromAddress(address: string, states: readonly string[]): string | null {
  const lower = address.toLowerCase();
  return states.find((s) => lower.includes(s.toLowerCase())) ?? null;
}

export async function companyProjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireRole("company"));

  const actorOf = (req: FastifyRequest): Actor => ({ type: "company", id: companyUser(req).sub });

  async function own(req: FastifyRequest) {
    const { id } = parse(idParam, req.params);
    const r = await getRequirement(id);
    if (r.companyId !== companyUser(req).companyId) throw notFound("Requirement not found");
    return r;
  }

  app.get("/company/projects", async (req) => {
    const { scope } = parse(listQuery, req.query);
    const rows = await db.query.requirements.findMany({
      where: eq(requirements.companyId, companyUser(req).companyId),
      orderBy: desc(requirements.createdAt),
      limit: 200,
    });
    const invitedCounts = await Promise.all(rows.map((r) => db.$count(requirementVendors, eq(requirementVendors.requirementId, r.id))));
    return rows
      .filter((r) => (scope === "open" ? OPEN.includes(r.status as (typeof OPEN)[number]) : scope === "closed" ? !OPEN.includes(r.status as (typeof OPEN)[number]) : true))
      .map((r, i) => ({ ...requirementSummary(r), invitedCount: invitedCounts[i] }));
  });

  app.post("/company/projects", async (req) => {
    const u = companyUser(req);
    const input = parse(requirementCreateSchema, req.body);
    const site = await db.query.sites.findFirst({ where: and(eq(sites.id, input.siteId), eq(sites.companyId, u.companyId)) });
    if (!site) throw badRequest("Choose one of your sites");
    const spec = validateSpec(input.category, input.spec);
    if (!spec.ok) throw badRequest(spec.message);
    const cfg = await getRfqConfig();
    const deadline = new Date(input.quoteDeadline);
    const days = (deadline.getTime() - Date.now()) / 86400_000;
    if (days < cfg.minDeadlineDays - 0.01) throw badRequest(`Give vendors at least ${cfg.minDeadlineDays} days to quote`);
    if (days > cfg.maxDeadlineDays) throw badRequest(`The quote deadline can be at most ${cfg.maxDeadlineDays} days away`);
    if (input.budgetMin !== null && input.budgetMax !== null && input.budgetMin > input.budgetMax) throw badRequest("Minimum budget is more than the maximum");

    const state = stateFromAddress(site.address, INDIAN_STATES) ?? stateFromAddress(site.label, INDIAN_STATES);
    if (!state) throw badRequest("Add the state name to the site's address (e.g. 'Ahmedabad, Gujarat') so we can match vendors in your area");
    const city = site.address.split(",").map((s) => s.trim()).filter(Boolean).at(-2) ?? site.label;

    const [r] = await db
      .insert(requirements)
      .values({
        companyId: u.companyId,
        siteId: site.id,
        raisedBy: u.sub,
        category: input.category,
        title: input.title,
        description: input.description,
        spec: spec.spec,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        quoteDeadline: deadline,
        startBy: input.startBy,
        surveyAllowed: input.surveyAllowed,
        state,
        city,
        maxQuotes: cfg.maxQuotes,
      })
      .returning();
    await logRequirementEvent(r!.id, actorOf(req), "Requirement submitted for review");
    await publish([channels.admin, channels.company(u.companyId)], { type: "requirement.updated", requirementId: r!.id, status: "SUBMITTED" });
    return { id: r!.id, code: requirementCode(r!) };
  });

  app.get("/company/projects/:id", async (req) => {
    const r = await own(req);
    return requirementDetail(r.id, { kind: "company" });
  });

  app.post("/company/projects/:id/attachments", async (req) => {
    const r = await own(req);
    if (!OPEN.includes(r.status as (typeof OPEN)[number])) throw conflict("This requirement is closed — attachments can no longer be added");
    const { name } = parse(attachmentQuery, req.query);
    const file = await req.file();
    if (!file) throw badRequest("Attach a file");
    const key = await saveDocument(await file.toBuffer(), file.mimetype, "rfq");
    await db.insert(requirementAttachments).values({ requirementId: r.id, fileKey: key, name: file.filename || name, uploadedBy: companyUser(req).sub });
    await logRequirementEvent(r.id, actorOf(req), `Added attachment: ${file.filename || name}`);
    return { ok: true };
  });

  app.post("/company/projects/:id/cancel", async (req) => {
    const r = await own(req);
    const { reason } = parse(rfqReasonSchema, req.body ?? {});
    const updated = await transitionRequirement(r.id, "CANCELLED", actorOf(req), { set: { closedAt: new Date() }, note: reason || "Cancelled by company" });
    const invited = await db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id) });
    await Promise.all(
      invited.map((i) =>
        notifyVendor(
          i.vendorId,
          { type: "requirement.updated", requirementId: r.id, status: "CANCELLED" },
          { subject: `Cancelled: ${requirementCode(updated)} — ${r.title}`, text: `The company cancelled this requirement. No further action is needed.` },
        ),
      ),
    );
    return { ok: true };
  });

  app.post("/company/projects/:id/questions/:questionId/answer", async (req) => {
    const r = await own(req);
    const { questionId } = parse(questionParam, req.params);
    const { answer } = parse(questionAnswerSchema, req.body);
    const [q] = await db
      .update(requirementQuestions)
      .set({ answer, answeredAt: new Date(), answeredBy: companyUser(req).sub })
      .where(and(eq(requirementQuestions.id, questionId), eq(requirementQuestions.requirementId, r.id)))
      .returning();
    if (!q) throw notFound("Question not found");
    await logRequirementEvent(r.id, actorOf(req), "Answered a vendor question");
    // Answers go to every invited vendor so nobody gets private information.
    const invited = await db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id) });
    await Promise.all(
      invited.map((i) =>
        notifyVendor(
          i.vendorId,
          { type: "requirement.question", requirementId: r.id, questionId: q.id, answered: true },
          { subject: `Answer posted on ${requirementCode(r)}: ${r.title}`, text: `Q: ${q.question}\nA: ${answer}` },
        ),
      ),
    );
    return { ok: true };
  });

  const decisions = { shortlist: "shortlist", "request-revision": "revision", award: "award", reject: "reject" } as const;
  for (const [path, decision] of Object.entries(decisions)) {
    app.post(`/company/projects/:id/quotes/:quoteId/${path}`, async (req) => {
      const r = await own(req);
      const { quoteId } = parse(quoteParam, req.params);
      const note = decision === "revision" ? parse(revisionRequestSchema, req.body).note : parse(rfqReasonSchema, req.body ?? {}).reason;
      await decideQuote(r, quoteId, decision, actorOf(req), note);
      return { ok: true };
    });
  }
}
