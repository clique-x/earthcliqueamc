import { asc, companies, db, desc, dispatchOffers, engineers, eq, locationPings, ratings, sites, ticketEvents, ticketMedia, ticketParts } from "@amc/db";
import { getTicket, ticketCode, type Ticket } from "./tickets";

type Viewer = "company" | "engineer" | "admin";

const fileUrl = (key: string) => `/files/${key}`;

export function engineerCard(e: typeof engineers.$inferSelect) {
  return {
    id: e.id,
    name: e.name,
    phone: e.phone,
    photoUrl: e.photoKey ? fileUrl(e.photoKey) : null,
    ratingAvg: Math.round(e.ratingAvg * 10) / 10,
    ratingCount: e.ratingCount,
  };
}

export function ticketSummary(t: Ticket) {
  return {
    id: t.id,
    code: ticketCode(t),
    category: t.category,
    priority: t.priority,
    title: t.title,
    status: t.status,
    feeEstimate: t.feeEstimate,
    feeFinal: t.feeFinal,
    createdAt: t.createdAt,
    assignedAt: t.assignedAt,
    closedAt: t.closedAt,
  };
}

const TRACKABLE = new Set(["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"]);

export async function ticketDetail(ticketId: string, viewer: Viewer) {
  const t = await getTicket(ticketId);
  const [site, company, engineer, events, media, parts, ratingRows] = await Promise.all([
    db.query.sites.findFirst({ where: eq(sites.id, t.siteId) }),
    db.query.companies.findFirst({ where: eq(companies.id, t.companyId) }),
    t.engineerId ? db.query.engineers.findFirst({ where: eq(engineers.id, t.engineerId) }) : undefined,
    db.query.ticketEvents.findMany({ where: eq(ticketEvents.ticketId, t.id), orderBy: asc(ticketEvents.createdAt) }),
    db.query.ticketMedia.findMany({ where: eq(ticketMedia.ticketId, t.id), orderBy: asc(ticketMedia.createdAt) }),
    db.query.ticketParts.findMany({ where: eq(ticketParts.ticketId, t.id), orderBy: asc(ticketParts.createdAt) }),
    db.query.ratings.findMany({ where: eq(ratings.ticketId, t.id) }),
  ]);

  let engineerLocation: { lat: number; lng: number; at: Date | null } | null = null;
  if (viewer !== "engineer" && engineer?.lastLocation && TRACKABLE.has(t.status)) {
    engineerLocation = { ...engineer.lastLocation, at: engineer.lastSeenAt };
  }

  const route =
    viewer !== "engineer" && t.status === "EN_ROUTE"
      ? (
          await db.query.locationPings.findMany({
            where: eq(locationPings.ticketId, t.id),
            orderBy: desc(locationPings.recordedAt),
            limit: 200,
          })
        )
          .reverse()
          .map((p) => p.location)
      : [];

  const offers =
    viewer === "admin"
      ? await db.query.dispatchOffers.findMany({ where: eq(dispatchOffers.ticketId, t.id), orderBy: asc(dispatchOffers.sentAt) })
      : [];

  return {
    ...ticketSummary(t),
    description: t.description,
    triage: t.triage,
    paid: t.paid,
    arrivedAt: t.arrivedAt,
    resolvedAt: t.resolvedAt,
    // OTPs are for the company to read out; engineers must never receive them.
    startOtp: viewer === "engineer" ? undefined : t.startOtp,
    closeOtp: viewer === "engineer" ? undefined : t.closeOtp,
    company: company ? { id: company.id, name: company.name } : null,
    site: site
      ? {
          id: site.id,
          label: site.label,
          address: site.address,
          lat: site.location.lat,
          lng: site.location.lng,
          contactName: site.contactName,
          contactPhone: site.contactPhone,
        }
      : null,
    engineer: engineer ? engineerCard(engineer) : null,
    engineerLocation,
    route,
    events: events.map((e) => ({
      id: e.id,
      actorType: e.actorType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt,
    })),
    media: media.map((m) => ({ id: m.id, kind: m.kind, url: fileUrl(m.fileKey), uploaderType: m.uploaderType, createdAt: m.createdAt })),
    parts: parts.map((p) => ({
      id: p.id,
      name: p.name,
      qty: p.qty,
      unitPrice: p.unitPrice,
      needsApproval: p.needsApproval,
      status: p.rejectedAt ? "rejected" : !p.needsApproval || p.approvedAt ? "approved" : "pending",
    })),
    ratings: ratingRows.map((r) => ({ fromType: r.fromType, score: r.score, comment: r.comment })),
    offers: offers.map((o) => ({
      id: o.id,
      engineerId: o.engineerId,
      round: o.round,
      wave: o.wave,
      distanceKm: o.distanceKm,
      sentAt: o.sentAt,
      response: o.response,
      respondedAt: o.respondedAt,
    })),
  };
}

export type TicketDetail = Awaited<ReturnType<typeof ticketDetail>>;

/** Sum of the visit fee and approved parts. */
export async function computeFinalFee(t: Ticket): Promise<number> {
  const parts = await db.query.ticketParts.findMany({ where: eq(ticketParts.ticketId, t.id) });
  const partsTotal = parts.filter((p) => !p.rejectedAt && (!p.needsApproval || p.approvedAt)).reduce((sum, p) => sum + p.qty * p.unitPrice, 0);
  return t.feeEstimate + partsTotal;
}
