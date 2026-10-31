import type { ProjectCategory, QuoteItemKind, QuoteStatus, RequirementStatus, SpecValue } from "@amc/shared";

export type RequirementSummary = {
  id: string;
  code: string;
  category: ProjectCategory;
  title: string;
  status: RequirementStatus;
  city: string;
  state: string;
  budgetMin: number | null;
  budgetMax: number | null;
  quoteDeadline: string;
  maxQuotes: number;
  createdAt: string;
  approvedAt: string | null;
  closedAt: string | null;
};

export type CompanyRequirementRow = RequirementSummary & { invitedCount: number };
export type AdminRequirementRow = RequirementSummary & { companyName: string; invited: number; quotes: number };
export type VendorRequirementRow = RequirementSummary & {
  deadlinePassed: boolean;
  myQuoteStatus: QuoteStatus | null;
  myQuoteTotal: number | null;
  myQuoteUpdatedAt: string | null;
  declined: boolean;
  viewed: boolean;
};

export type QuoteItem = {
  id: string;
  kind: QuoteItemKind;
  description: string;
  brandModel: string;
  qty: number;
  unit: string;
  unitPrice: number;
  gstPercent: number;
  lineTotal: number;
};

export type VendorCard = {
  id: string;
  name: string;
  city: string;
  ratingAvg: number;
  ratingCount: number;
  certifications: string[];
  teamSize: number | null;
  foundedYear: number | null;
  isEarthclique: boolean;
  contact: { name: string; email: string; phone: string } | null;
};

export type QuoteView = {
  id: string;
  vendorId: string;
  version: number;
  status: QuoteStatus;
  subtotal: number;
  gstTotal: number;
  total: number;
  timelineDays: number | null;
  warrantyMonths: number | null;
  paymentTerms: string;
  validUntil: string | null;
  notes: string;
  surveyRequired: boolean;
  revisionNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
  items: QuoteItem[];
  vendor: VendorCard | null;
};

export type RequirementQuestion = {
  id: string;
  vendorName: string | null;
  mine: boolean;
  question: string;
  answer: string | null;
  askedAt: string;
  answeredAt: string | null;
};

export type RequirementDetail = RequirementSummary & {
  description: string;
  spec: Record<string, SpecValue>;
  specLines: { label: string; value: string }[];
  startBy: string | null;
  surveyAllowed: boolean;
  rejectionReason?: string | null;
  awardedQuoteId: string | null;
  slotsUsed: number;
  slotsLeft: number;
  deadlinePassed: boolean;
  company: { id: string; name: string } | null;
  site: {
    id: string;
    label: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    contactName: string | null;
    contactPhone: string | null;
  } | null;
  contactRevealed: boolean;
  attachments: { id: string; name: string; url: string; createdAt: string }[];
  questions: RequirementQuestion[];
  quotes: QuoteView[];
  myQuote: QuoteView | null;
  myInvite: { invitedAt: string; viewedAt: string | null; declinedAt: string | null } | null;
  invites?: { vendorId: string; vendorName: string | null; rank: number; invitedAt: string; viewedAt: string | null; declinedAt: string | null }[];
  invitedCount?: number;
  events: { id: string; actorType: "company" | "vendor" | "admin" | "system"; fromStatus: RequirementStatus | null; toStatus: RequirementStatus | null; note: string | null; createdAt: string }[];
};

export type VendorProfile = {
  id: string;
  name: string;
  gstin: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejectionReason: string | null;
  categories: ProjectCategory[];
  states: string[];
  city: string;
  description: string;
  website: string;
  certifications: string[];
  teamSize: number | null;
  foundedYear: number | null;
  subscriptionUntil: string | null;
  subscribed: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
};

export type VendorMe = { vendor: VendorProfile; user: { id: string; name: string; email: string; phone: string; role: "admin" | "member" } };
