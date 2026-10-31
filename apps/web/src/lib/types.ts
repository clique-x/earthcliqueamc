import type { ActorType, Category, TicketStatus } from "@amc/shared";

export type LatLng = { lat: number; lng: number };

export type TicketListItem = {
  id: string;
  code: string;
  category: Category;
  priority: "normal" | "urgent";
  title: string;
  status: TicketStatus;
  feeEstimate: number;
  feeFinal: number | null;
  createdAt: string;
  assignedAt: string | null;
  closedAt: string | null;
  siteLabel: string;
  engineerName: string | null;
  companyName?: string;
  paid?: boolean;
};

export type TicketDetail = Omit<TicketListItem, "siteLabel" | "engineerName" | "companyName"> & {
  description: string;
  triage: Record<string, string>;
  paid: boolean;
  arrivedAt: string | null;
  resolvedAt: string | null;
  startOtp?: string | null;
  closeOtp?: string | null;
  company: { id: string; name: string } | null;
  site: (LatLng & { id: string; label: string; address: string; contactName: string; contactPhone: string }) | null;
  engineer: { id: string; name: string; phone: string; photoUrl: string | null; ratingAvg: number; ratingCount: number } | null;
  engineerLocation: (LatLng & { at: string | null }) | null;
  route: LatLng[];
  events: { id: string; actorType: ActorType; fromStatus: TicketStatus | null; toStatus: TicketStatus | null; note: string | null; createdAt: string }[];
  media: { id: string; kind: "issue" | "before" | "after"; url: string; uploaderType: ActorType; createdAt: string }[];
  parts: { id: string; name: string; qty: number; unitPrice: number; needsApproval: boolean; status: "approved" | "pending" | "rejected" }[];
  ratings: { fromType: ActorType; score: number; comment: string }[];
  offers: { id: string; engineerId: string; round: number; wave: number; distanceKm: number; sentAt: string; response: string | null; respondedAt: string | null }[];
};

export type Site = LatLng & { id: string; label: string; address: string; contactName: string; contactPhone: string };
