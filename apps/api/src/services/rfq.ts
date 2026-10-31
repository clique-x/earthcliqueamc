import {
  and,
  companyUsers,
  db,
  eq,
  inArray,
  ne,
  quoteItems,
  quotes,
  requirementEvents,
  requirementVendors,
  requirements,
  sql,
  vendorUsers,
  vendors,
} from "@amc/db";
import {
  ACTIVE_QUOTE_STATUSES,
  canTransitionQuote,
  canTransitionRequirement,
  PROJECT_CATEGORY_INFO,
  QUOTE_STATUS_LABELS,
  quoteTotals,
  REQUIREMENT_STATUS_LABELS,
  type QuoteStatus,
  type RequirementStatus,
  type RfqActor,
  type ServerEvent,
} from "@amc/shared";
import type { z } from "zod";
import type { quoteSaveSchema, quoteSubmitSchema } from "@amc/shared";
import { Queue, Worker } from "bullmq";
import { env } from "../env";
import { getRfqConfig } from "../lib/config";
import { channels, publish } from "../lib/events";
import { portalUrl, sendEmail } from "../lib/email";
import { conflict, forbidden, notFound } from "../lib/http";

export type Requirement = typeof requirements.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Actor = { type: RfqActor; id: string | null };
export const SYSTEM: Actor = { type: "system", id: null };

export const requirementCode = (r: Pick<Requirement, "number">) => `RQ-${10000 + r.number}`;

const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null };
export const rfqQueue = new Queue("rfq", { connection });

// ---------------------------------------------------------------------------
// Requirement lifecycle
// ---------------------------------------------------------------------------

export async function getRequirement(id: string): Promise<Requirement> {
  const r = await db.query.requirements.findFirst({ where: eq(requirements.id, id) });
  if (!r) throw notFound("Requirement not found");
  return r;
}

type TransitionOptions = { set?: Partial<typeof requirements.$inferInsert>; note?: string; meta?: Record<string, unknown> };

export async function transitionRequirement(id: string, to: RequirementStatus, actor: Actor, opts: TransitionOptions = {}): Promise<Requirement> {
  const current = await getRequirement(id);
  if (!canTransitionRequirement(current.status, to, actor.type)) {
    throw conflict(`Requirement is "${REQUIREMENT_STATUS_LABELS[current.status]}" — this action isn't available now`, "invalid_transition");
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(requirements)
      .set({ ...opts.set, status: to })
      .where(and(eq(requirements.id, id), eq(requirements.status, current.status)))
      .returning();
    if (!row) return null;
    await tx.insert(requirementEvents).values({
      requirementId: id,
      actorType: actor.type,
      actorId: actor.id,
      fromStatus: current.status,
      toStatus: to,
      note: opts.note || null,
      meta: opts.meta ?? {},
    });
    return row;
  });
  if (!updated) throw conflict("Requirement was just updated — refresh and try again");
  await broadcastRequirement(updated);
  return updated;
}

export async function logRequirementEvent(id: string, actor: Actor, note: string, meta: Record<string, unknown> = {}) {
  await db.insert(requirementEvents).values({ requirementId: id, actorType: actor.type, actorId: actor.id, note, meta });
  await broadcastRequirement(await getRequirement(id));
}

/** Tells every open view of this requirement (company, admin, invited vendors) to refresh. */
export async function broadcastRequirement(r: Requirement) {
  const invited = await db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id), columns: { vendorId: true } });
  const targets = [channels.requirement(r.id), channels.company(r.companyId), channels.admin, ...invited.map((i) => channels.vendor(i.vendorId))];
  await publish(targets, { type: "requirement.updated", requirementId: r.id, status: r.status });
}

// ---------------------------------------------------------------------------
// Notifications: real-time + email
// ---------------------------------------------------------------------------

async function vendorEmails(vendorId: string) {
  const users = await db.query.vendorUsers.findMany({ where: eq(vendorUsers.vendorId, vendorId), columns: { email: true, role: true } });
  // Admins always; members too for a small team so nobody misses a lead.
  return users.map((u) => u.email);
}

export async function notifyVendor(vendorId: string, event: ServerEvent, email?: { subject: string; text: string }) {
  await publish([channels.vendor(vendorId)], event);
  if (email) await sendEmail({ to: await vendorEmails(vendorId), ...email });
}

export async function notifyCompany(r: Requirement, event: ServerEvent, email?: { subject: string; text: string }) {
  await publish([channels.company(r.companyId), channels.requirement(r.id)], event);
  if (!email) return;
  const raiser = await db.query.companyUsers.findFirst({ where: eq(companyUsers.id, r.raisedBy), columns: { email: true } });
  if (raiser) await sendEmail({ to: [raiser.email], ...email });
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type Match = { id: string; name: string };

/**
 * Vendors who can quote: verified, subscribed, do this kind of work, and cover the requirement's state.
 * Best rated and most recently active first.
 */
export async function findMatchingVendors(r: Requirement, limit: number): Promise<Match[]> {
  const cfg = await getRfqConfig();
  return db.execute<Match>(sql`
    select v.id, v.name
    from vendors v
    where v.status = 'approved'
      and v.subscription_until > now()
      and ${r.category}::project_category = any(v.categories)
      and (${r.state} = any(v.states) or 'ALL' = any(v.states))
      and (v.is_earthclique = false or ${cfg.earthcliqueBids})
    order by v.rating_avg desc, v.rating_count desc, v.last_active_at desc nulls last
    limit ${limit}
  `);
}

/** Called when ops approves a requirement: invites the matched vendors and tells them. */
export async function inviteVendors(r: Requirement) {
  const cfg = await getRfqConfig();
  const already = new Set((await db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id), columns: { vendorId: true } })).map((i) => i.vendorId));
  const ranked = await findMatchingVendors(r, cfg.maxInvites);
  // Re-sending after new vendors were verified must not spam the ones already invited.
  const matches = ranked.filter((m) => !already.has(m.id));
  if (matches.length === 0) return 0;
  await db
    .insert(requirementVendors)
    .values(matches.map((m) => ({ requirementId: r.id, vendorId: m.id, matchRank: ranked.findIndex((x) => x.id === m.id) + 1 })))
    .onConflictDoNothing();
  await db.insert(requirementEvents).values({
    requirementId: r.id,
    actorType: "system",
    note: `Sent to ${matches.length} ${already.size ? "more " : ""}matching vendor${matches.length === 1 ? "" : "s"}`,
    meta: { vendorIds: matches.map((m) => m.id) },
  });
  const code = requirementCode(r);
  const label = PROJECT_CATEGORY_INFO[r.category].label;
  await Promise.all(
    matches.map((m) =>
      notifyVendor(
        m.id,
        { type: "requirement.invited", requirementId: r.id, code, title: r.title },
        {
          subject: `New ${label} requirement in ${r.city}: ${r.title} (${code})`,
          text: `A company in ${r.city}, ${r.state} is looking for quotes.\n\n${r.title}\nQuotes close: ${r.quoteDeadline.toLocaleString("en-IN")}\n\nView and quote: ${portalUrl(`/vendor/requirements/${r.id}`)}`,
        },
      ),
    ),
  );
  return matches.length;
}

/** Marks the requirement expired at the deadline if nobody quoted. */
export async function scheduleExpiry(r: Requirement) {
  await rfqQueue.add(
    "expire",
    { requirementId: r.id },
    { jobId: `expire-${r.id}-${r.quoteDeadline.getTime()}`, delay: Math.max(0, r.quoteDeadline.getTime() - Date.now()), removeOnComplete: 1000, removeOnFail: 1000 },
  );
}

async function runExpiry(requirementId: string) {
  const r = await getRequirement(requirementId);
  if (r.status !== "OPEN") return;
  const active = await db.$count(quotes, and(eq(quotes.requirementId, r.id), inArray(quotes.status, ACTIVE_QUOTE_STATUSES)));
  if (active > 0) return;
  const updated = await transitionRequirement(r.id, "EXPIRED", SYSTEM, { set: { closedAt: new Date() }, note: "Quote deadline passed with no quotes" });
  await notifyCompany(
    updated,
    { type: "requirement.updated", requirementId: r.id, status: "EXPIRED" },
    {
      subject: `No quotes received for ${requirementCode(r)}`,
      text: `The quote deadline for "${r.title}" has passed without any quotes. You can post it again with a longer deadline or a wider scope.\n\n${portalUrl(`/app/projects/${r.id}`)}`,
    },
  );
}

export function startRfqWorker() {
  const worker = new Worker(
    "rfq",
    async (job) => {
      if (job.name === "expire") await runExpiry((job.data as { requirementId: string }).requirementId);
    },
    { connection, concurrency: 5 },
  );
  worker.on("failed", (job, err) => console.error(`[rfq] job ${job?.name} ${job?.id} failed`, err));
  return worker;
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

type QuoteSave = z.infer<typeof quoteSaveSchema>;
type QuoteSubmit = z.infer<typeof quoteSubmitSchema>;

async function assertVendorMayQuote(vendorId: string, r: Requirement) {
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, vendorId) });
  if (!vendor || vendor.status !== "approved") throw forbidden("Your vendor account is not verified yet");
  if (!vendor.subscriptionUntil || vendor.subscriptionUntil < new Date()) throw forbidden("An active EarthClique subscription is needed to quote");
  const invite = await db.query.requirementVendors.findFirst({
    where: and(eq(requirementVendors.requirementId, r.id), eq(requirementVendors.vendorId, vendorId)),
  });
  if (!invite) throw forbidden("This requirement was not sent to your company");
  if (r.status !== "OPEN") throw conflict(`This requirement is ${REQUIREMENT_STATUS_LABELS[r.status].toLowerCase()}`);
}

async function writeItems(quoteId: string, items: QuoteSave["items"]) {
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  if (items.length === 0) return;
  await db.insert(quoteItems).values(items.map((it, i) => ({ quoteId, sort: i, ...it })));
}

/** Creates or updates the vendor's draft. Allowed while the quote is a draft or a revision was requested. */
export async function saveQuoteDraft(vendorId: string, r: Requirement, input: QuoteSave): Promise<Quote> {
  await assertVendorMayQuote(vendorId, r);
  const existing = await db.query.quotes.findFirst({ where: and(eq(quotes.requirementId, r.id), eq(quotes.vendorId, vendorId)) });
  const editable: QuoteStatus[] = ["DRAFT", "REVISION_REQUESTED", "WITHDRAWN"];
  if (existing && !editable.includes(existing.status)) {
    throw conflict(`Your quote is ${QUOTE_STATUS_LABELS[existing.status].toLowerCase()} — withdraw it to edit`);
  }
  const totals = quoteTotals(input.items);
  const { items, ...fields } = input;
  const values = { ...fields, ...totals, updatedAt: new Date(), ...(existing?.status === "WITHDRAWN" && { status: "DRAFT" as const, decidedAt: null }) };
  const [row] = existing
    ? await db.update(quotes).set(values).where(eq(quotes.id, existing.id)).returning()
    : await db
        .insert(quotes)
        .values({ requirementId: r.id, vendorId, ...values })
        .returning();
  await writeItems(row!.id, items);
  await touchVendor(vendorId);
  return row!;
}

export async function submitQuote(vendorId: string, r: Requirement, input: QuoteSubmit): Promise<Quote> {
  await assertVendorMayQuote(vendorId, r);
  if (r.quoteDeadline < new Date()) throw conflict("The quote deadline has passed");
  const existing = await db.query.quotes.findFirst({ where: and(eq(quotes.requirementId, r.id), eq(quotes.vendorId, vendorId)) });
  const from: QuoteStatus = existing?.status ?? "DRAFT";
  if (!canTransitionQuote(from, "SUBMITTED", "vendor")) throw conflict(`Your quote is already ${QUOTE_STATUS_LABELS[from].toLowerCase()}`);

  const othersActive = await db.$count(
    quotes,
    and(eq(quotes.requirementId, r.id), ne(quotes.vendorId, vendorId), inArray(quotes.status, ACTIVE_QUOTE_STATUSES)),
  );
  if (othersActive >= r.maxQuotes) throw conflict("All quote slots for this requirement are taken", "slots_full");

  const totals = quoteTotals(input.items);
  const { items, ...fields } = input;
  const now = new Date();
  const values = {
    ...fields,
    ...totals,
    status: "SUBMITTED" as const,
    submittedAt: now,
    updatedAt: now,
    revisionNote: null,
    decidedAt: null,
    version: existing ? (from === "REVISION_REQUESTED" || from === "WITHDRAWN" ? existing.version + 1 : existing.version) : 1,
  };
  const [row] = existing
    ? await db.update(quotes).set(values).where(eq(quotes.id, existing.id)).returning()
    : await db
        .insert(quotes)
        .values({ requirementId: r.id, vendorId, ...values })
        .returning();
  await writeItems(row!.id, items);
  await touchVendor(vendorId);
  // Quoting cancels an earlier "not interested".
  await db.update(requirementVendors).set({ declinedAt: null }).where(and(eq(requirementVendors.requirementId, r.id), eq(requirementVendors.vendorId, vendorId)));

  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, vendorId), columns: { name: true } });
  await db.insert(requirementEvents).values({
    requirementId: r.id,
    actorType: "vendor",
    actorId: vendorId,
    note: `${vendor?.name ?? "A vendor"} ${from === "REVISION_REQUESTED" ? "sent a revised quote" : "submitted a quote"} (v${row!.version})`,
    meta: { quoteId: row!.id, total: row!.total },
  });
  await notifyCompany(
    r,
    { type: "quote.updated", requirementId: r.id, quoteId: row!.id, status: "SUBMITTED" },
    {
      subject: `${from === "REVISION_REQUESTED" ? "Revised quote" : "New quote"} for ${requirementCode(r)} from ${vendor?.name ?? "a vendor"}`,
      text: `${vendor?.name ?? "A vendor"} quoted ₹${row!.total.toLocaleString("en-IN")} (incl. GST) for "${r.title}".\n\nCompare quotes: ${portalUrl(`/app/projects/${r.id}`)}`,
    },
  );
  await broadcastRequirement(r);
  return row!;
}

export async function withdrawQuote(vendorId: string, r: Requirement): Promise<Quote> {
  const existing = await db.query.quotes.findFirst({ where: and(eq(quotes.requirementId, r.id), eq(quotes.vendorId, vendorId)) });
  if (!existing) throw notFound("No quote to withdraw");
  if (!canTransitionQuote(existing.status, "WITHDRAWN", "vendor")) throw conflict(`Your quote is ${QUOTE_STATUS_LABELS[existing.status].toLowerCase()}`);
  const [row] = await db.update(quotes).set({ status: "WITHDRAWN", decidedAt: new Date(), updatedAt: new Date() }).where(eq(quotes.id, existing.id)).returning();
  if (existing.status !== "DRAFT") {
    const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, vendorId), columns: { name: true } });
    await logRequirementEvent(r.id, { type: "vendor", id: vendorId }, `${vendor?.name ?? "A vendor"} withdrew their quote`);
    await notifyCompany(r, { type: "quote.updated", requirementId: r.id, quoteId: row!.id, status: "WITHDRAWN" });
  }
  return row!;
}

export type QuoteDecision = "shortlist" | "revision" | "award" | "reject";

/** Company decides on a quote. Awarding closes the requirement and rejects every other quote. */
export async function decideQuote(r: Requirement, quoteId: string, decision: QuoteDecision, actor: Actor, note = ""): Promise<Quote> {
  const q = await db.query.quotes.findFirst({ where: and(eq(quotes.id, quoteId), eq(quotes.requirementId, r.id)) });
  if (!q || q.status === "DRAFT") throw notFound("Quote not found");
  const to = ({ shortlist: "SHORTLISTED", revision: "REVISION_REQUESTED", award: "AWARDED", reject: "REJECTED" } as const)[decision];
  if (!canTransitionQuote(q.status, to, "company")) throw conflict(`This quote is ${QUOTE_STATUS_LABELS[q.status].toLowerCase()}`);
  if (decision === "award" && r.status !== "OPEN") throw conflict("This requirement is no longer open");

  const now = new Date();
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, q.vendorId), columns: { name: true } });
  const vendorName = vendor?.name ?? "the vendor";

  const [updated] = await db
    .update(quotes)
    .set({
      status: to,
      updatedAt: now,
      ...(decision === "revision" && { revisionNote: note }),
      ...((decision === "award" || decision === "reject") && { decidedAt: now }),
    })
    .where(and(eq(quotes.id, q.id), eq(quotes.status, q.status)))
    .returning();
  if (!updated) throw conflict("Quote was just updated — refresh and try again");

  const eventNote = {
    shortlist: `Shortlisted ${vendorName}`,
    revision: `Asked ${vendorName} for a revised quote: ${note}`,
    award: `Awarded to ${vendorName} — ₹${q.total.toLocaleString("en-IN")}`,
    reject: `Declined ${vendorName}'s quote${note ? `: ${note}` : ""}`,
  }[decision];

  if (decision === "award") {
    await transitionRequirement(r.id, "AWARDED", actor, { set: { awardedQuoteId: q.id, closedAt: now }, note: eventNote });
    const losers = await db
      .update(quotes)
      .set({ status: "REJECTED", decidedAt: now, updatedAt: now })
      .where(and(eq(quotes.requirementId, r.id), ne(quotes.id, q.id), inArray(quotes.status, ["SUBMITTED", "SHORTLISTED", "REVISION_REQUESTED"])))
      .returning({ id: quotes.id, vendorId: quotes.vendorId });
    await Promise.all(
      losers.map((l) =>
        notifyVendor(
          l.vendorId,
          { type: "quote.updated", requirementId: r.id, quoteId: l.id, status: "REJECTED" },
          { subject: `Not selected: ${requirementCode(r)} — ${r.title}`, text: `The company chose another vendor for "${r.title}". Thank you for quoting.\n\n${portalUrl(`/vendor/requirements/${r.id}`)}` },
        ),
      ),
    );
  } else {
    await logRequirementEvent(r.id, actor, eventNote, { quoteId: q.id });
  }

  const subject = {
    shortlist: `Shortlisted: ${requirementCode(r)} — ${r.title}`,
    revision: `Revision requested: ${requirementCode(r)} — ${r.title}`,
    award: `You won: ${requirementCode(r)} — ${r.title}`,
    reject: `Not selected: ${requirementCode(r)} — ${r.title}`,
  }[decision];
  const text = {
    shortlist: `Your quote has been shortlisted. The company's site address and contact details are now visible to you.`,
    revision: `The company asked for a revised quote:\n\n"${note}"\n\nEdit and resubmit your quote.`,
    award: `Congratulations — the company awarded this project to you. Their contact details are in the portal.`,
    reject: `The company did not select your quote. Thank you for quoting.`,
  }[decision];
  await notifyVendor(
    q.vendorId,
    { type: "quote.updated", requirementId: r.id, quoteId: q.id, status: to },
    { subject, text: `${text}\n\n${portalUrl(`/vendor/requirements/${r.id}`)}` },
  );
  return updated;
}

async function touchVendor(vendorId: string) {
  await db.update(vendors).set({ lastActiveAt: new Date() }).where(eq(vendors.id, vendorId));
}
