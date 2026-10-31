export const REQUIREMENT_STATUSES = ["SUBMITTED", "OPEN", "REJECTED", "AWARDED", "CANCELLED", "EXPIRED"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const QUOTE_STATUSES = ["DRAFT", "SUBMITTED", "SHORTLISTED", "REVISION_REQUESTED", "AWARDED", "REJECTED", "WITHDRAWN"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type RfqActor = "company" | "vendor" | "admin" | "system";

export const REQUIREMENT_TRANSITIONS: Record<RequirementStatus, Partial<Record<RequirementStatus, RfqActor[]>>> = {
  SUBMITTED: { OPEN: ["admin"], REJECTED: ["admin"], CANCELLED: ["company", "admin"] },
  OPEN: { AWARDED: ["company"], CANCELLED: ["company", "admin"], EXPIRED: ["system"] },
  REJECTED: {},
  AWARDED: {},
  CANCELLED: {},
  EXPIRED: {},
};

export const QUOTE_TRANSITIONS: Record<QuoteStatus, Partial<Record<QuoteStatus, RfqActor[]>>> = {
  DRAFT: { SUBMITTED: ["vendor"] },
  SUBMITTED: { SHORTLISTED: ["company"], REVISION_REQUESTED: ["company"], AWARDED: ["company"], REJECTED: ["company", "system"], WITHDRAWN: ["vendor"] },
  SHORTLISTED: { REVISION_REQUESTED: ["company"], AWARDED: ["company"], REJECTED: ["company", "system"], WITHDRAWN: ["vendor"] },
  REVISION_REQUESTED: { SUBMITTED: ["vendor"], REJECTED: ["company", "system"], WITHDRAWN: ["vendor"] },
  AWARDED: {},
  REJECTED: {},
  // A vendor who withdrew may quote again while the requirement is open (subject to free slots).
  WITHDRAWN: { DRAFT: ["vendor"], SUBMITTED: ["vendor"] },
};

export const canTransitionRequirement = (from: RequirementStatus, to: RequirementStatus, actor: RfqActor) =>
  REQUIREMENT_TRANSITIONS[from][to]?.includes(actor) ?? false;

export const canTransitionQuote = (from: QuoteStatus, to: QuoteStatus, actor: RfqActor) => QUOTE_TRANSITIONS[from][to]?.includes(actor) ?? false;

/** Quotes that occupy one of the requirement's quote slots. */
export const ACTIVE_QUOTE_STATUSES: QuoteStatus[] = ["SUBMITTED", "SHORTLISTED", "REVISION_REQUESTED", "AWARDED"];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  SUBMITTED: "Under review",
  OPEN: "Open for quotes",
  REJECTED: "Not approved",
  AWARDED: "Awarded",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired — no quotes",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  SHORTLISTED: "Shortlisted",
  REVISION_REQUESTED: "Revision requested",
  AWARDED: "Awarded",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

export const QUOTE_ITEM_KINDS = ["material", "labour", "service", "other"] as const;
export type QuoteItemKind = (typeof QUOTE_ITEM_KINDS)[number];

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export type QuoteItemInput = { kind: QuoteItemKind; description: string; brandModel?: string; qty: number; unit: string; unitPrice: number; gstPercent: number };

/** Totals in whole rupees, GST rounded per line like a tax invoice. */
export function quoteTotals(items: QuoteItemInput[]) {
  let subtotal = 0;
  let gstTotal = 0;
  for (const it of items) {
    const line = it.qty * it.unitPrice;
    subtotal += line;
    gstTotal += Math.round((line * it.gstPercent) / 100);
  }
  return { subtotal, gstTotal, total: subtotal + gstTotal };
}
