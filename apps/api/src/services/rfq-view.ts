import {
  and,
  asc,
  companies,
  db,
  desc,
  eq,
  inArray,
  ne,
  quoteItems,
  quotes,
  requirementAttachments,
  requirementEvents,
  requirementQuestions,
  requirementVendors,
  sites,
  vendorUsers,
  vendors,
} from "@amc/db";
import { ACTIVE_QUOTE_STATUSES, describeSpec } from "@amc/shared";
import { getRequirement, requirementCode, type Quote, type Requirement } from "./rfq";

export type Viewer = { kind: "company" } | { kind: "admin" } | { kind: "vendor"; vendorId: string };

const fileUrl = (key: string) => `/files/${key}`;

export function requirementSummary(r: Requirement) {
  return {
    id: r.id,
    code: requirementCode(r),
    category: r.category,
    title: r.title,
    status: r.status,
    city: r.city,
    state: r.state,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    quoteDeadline: r.quoteDeadline,
    maxQuotes: r.maxQuotes,
    createdAt: r.createdAt,
    approvedAt: r.approvedAt,
    closedAt: r.closedAt,
  };
}

export function vendorCard(v: typeof vendors.$inferSelect) {
  return {
    id: v.id,
    name: v.name,
    city: v.city,
    ratingAvg: Math.round(v.ratingAvg * 10) / 10,
    ratingCount: v.ratingCount,
    certifications: v.certifications,
    teamSize: v.teamSize,
    foundedYear: v.foundedYear,
    isEarthclique: v.isEarthclique,
  };
}

export async function vendorContact(vendorId: string) {
  const admin = await db.query.vendorUsers.findFirst({ where: and(eq(vendorUsers.vendorId, vendorId), eq(vendorUsers.role, "admin")), orderBy: asc(vendorUsers.createdAt) });
  return admin ? { name: admin.name, email: admin.email, phone: admin.phone } : null;
}

export async function quoteWithItems(q: Quote) {
  const items = await db.query.quoteItems.findMany({ where: eq(quoteItems.quoteId, q.id), orderBy: asc(quoteItems.sort) });
  return {
    id: q.id,
    vendorId: q.vendorId,
    version: q.version,
    status: q.status,
    subtotal: q.subtotal,
    gstTotal: q.gstTotal,
    total: q.total,
    timelineDays: q.timelineDays,
    warrantyMonths: q.warrantyMonths,
    paymentTerms: q.paymentTerms,
    validUntil: q.validUntil,
    notes: q.notes,
    surveyRequired: q.surveyRequired,
    revisionNote: q.revisionNote,
    submittedAt: q.submittedAt,
    decidedAt: q.decidedAt,
    updatedAt: q.updatedAt,
    items: items.map((it) => ({
      id: it.id,
      kind: it.kind,
      description: it.description,
      brandModel: it.brandModel,
      qty: it.qty,
      unit: it.unit,
      unitPrice: it.unitPrice,
      gstPercent: it.gstPercent,
      lineTotal: Math.round(it.qty * it.unitPrice),
    })),
  };
}

/** Everything a viewer may see about a requirement. Contact details are hidden from vendors until they're shortlisted or awarded. */
export async function requirementDetail(id: string, viewer: Viewer) {
  const r = await getRequirement(id);
  const [site, company, attachments, questions, events, invites] = await Promise.all([
    db.query.sites.findFirst({ where: eq(sites.id, r.siteId) }),
    db.query.companies.findFirst({ where: eq(companies.id, r.companyId) }),
    db.query.requirementAttachments.findMany({ where: eq(requirementAttachments.requirementId, r.id), orderBy: asc(requirementAttachments.createdAt) }),
    db.query.requirementQuestions.findMany({ where: eq(requirementQuestions.requirementId, r.id), orderBy: asc(requirementQuestions.createdAt) }),
    viewer.kind === "vendor" ? Promise.resolve([]) : db.query.requirementEvents.findMany({ where: eq(requirementEvents.requirementId, r.id), orderBy: asc(requirementEvents.createdAt) }),
    db.query.requirementVendors.findMany({ where: eq(requirementVendors.requirementId, r.id), orderBy: asc(requirementVendors.matchRank) }),
  ]);

  const myInvite = viewer.kind === "vendor" ? invites.find((i) => i.vendorId === viewer.vendorId) ?? null : null;
  const quoteRows =
    viewer.kind === "vendor"
      ? await db.query.quotes.findMany({ where: and(eq(quotes.requirementId, r.id), eq(quotes.vendorId, viewer.vendorId)) })
      : await db.query.quotes.findMany({ where: and(eq(quotes.requirementId, r.id), ne(quotes.status, "DRAFT")), orderBy: [asc(quotes.total), desc(quotes.submittedAt)] });
  const myQuote = viewer.kind === "vendor" ? quoteRows[0] ?? null : null;
  const revealed = viewer.kind !== "vendor" || (myQuote !== null && (myQuote.status === "SHORTLISTED" || myQuote.status === "AWARDED"));

  const vendorIds = [...new Set([...quoteRows.map((q) => q.vendorId), ...questions.map((q) => q.vendorId), ...invites.map((i) => i.vendorId)])];
  const vendorRows = vendorIds.length ? await db.query.vendors.findMany({ where: inArray(vendors.id, vendorIds) }) : [];
  const vendorById = new Map(vendorRows.map((v) => [v.id, v]));

  const slotsUsed = (viewer.kind === "vendor"
    ? await db.query.quotes.findMany({ where: and(eq(quotes.requirementId, r.id), inArray(quotes.status, ACTIVE_QUOTE_STATUSES)), columns: { id: true } })
    : quoteRows.filter((q) => ACTIVE_QUOTE_STATUSES.includes(q.status))
  ).length;

  const quoteViews = await Promise.all(
    quoteRows.map(async (q) => {
      const v = vendorById.get(q.vendorId);
      const contactVisible = viewer.kind === "admin" || (viewer.kind === "company" && (q.status === "SHORTLISTED" || q.status === "AWARDED"));
      return {
        ...(await quoteWithItems(q)),
        vendor: v ? { ...vendorCard(v), contact: contactVisible ? await vendorContact(v.id) : null } : null,
      };
    }),
  );

  return {
    ...requirementSummary(r),
    description: r.description,
    spec: r.spec,
    specLines: describeSpec(r.category, r.spec),
    startBy: r.startBy,
    surveyAllowed: r.surveyAllowed,
    rejectionReason: viewer.kind === "vendor" ? undefined : r.rejectionReason,
    awardedQuoteId: r.awardedQuoteId,
    slotsUsed,
    slotsLeft: Math.max(0, r.maxQuotes - slotsUsed),
    deadlinePassed: r.quoteDeadline < new Date(),
    company: company ? { id: company.id, name: company.name } : null,
    site: site
      ? revealed
        ? { id: site.id, label: site.label, address: site.address, lat: site.location.lat, lng: site.location.lng, contactName: site.contactName, contactPhone: site.contactPhone }
        : { id: site.id, label: null, address: null, lat: null, lng: null, contactName: null, contactPhone: null }
      : null,
    contactRevealed: revealed,
    attachments: attachments.map((a) => ({ id: a.id, name: a.name, url: fileUrl(a.fileKey), createdAt: a.createdAt })),
    questions: questions.map((q) => ({
      id: q.id,
      // Other vendors must not learn who is bidding, so vendors only see their own name.
      vendorName: viewer.kind === "vendor" && q.vendorId !== viewer.vendorId ? null : vendorById.get(q.vendorId)?.name ?? null,
      mine: viewer.kind === "vendor" && q.vendorId === viewer.vendorId,
      question: q.question,
      answer: q.answer,
      askedAt: q.createdAt,
      answeredAt: q.answeredAt,
    })),
    quotes: quoteViews,
    myQuote: myQuote ? quoteViews[0] ?? null : null,
    myInvite: myInvite ? { invitedAt: myInvite.invitedAt, viewedAt: myInvite.viewedAt, declinedAt: myInvite.declinedAt } : null,
    invites:
      viewer.kind === "admin"
        ? invites.map((i) => ({ vendorId: i.vendorId, vendorName: vendorById.get(i.vendorId)?.name ?? null, rank: i.matchRank, invitedAt: i.invitedAt, viewedAt: i.viewedAt, declinedAt: i.declinedAt }))
        : undefined,
    invitedCount: viewer.kind === "vendor" ? undefined : invites.length,
    events: events.map((e) => ({ id: e.id, actorType: e.actorType, fromStatus: e.fromStatus, toStatus: e.toStatus, note: e.note, createdAt: e.createdAt })),
  };
}

export type RequirementDetail = Awaited<ReturnType<typeof requirementDetail>>;
