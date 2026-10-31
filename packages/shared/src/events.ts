import type { Category } from "./categories";
import type { QuoteStatus, RequirementStatus } from "./requirement-status";
import type { TicketStatus } from "./ticket-status";

/** Payload of a ring sent to an engineer's phone. */
export type RingPayload = {
  offerId: string;
  ticketId: string;
  code: string;
  category: Category;
  priority: "normal" | "urgent";
  title: string;
  distanceKm: number;
  feeEstimate: number;
  expiresAt: string;
  triage: Record<string, string>;
};

/** Messages pushed from the API over WebSocket. */
export type ServerEvent =
  | { type: "ring"; ring: RingPayload }
  | { type: "ring.cancel"; offerId: string; ticketId: string; reason: "taken" | "timeout" | "cancelled" }
  | { type: "ticket.updated"; ticketId: string; status: TicketStatus }
  | { type: "engineer.location"; engineerId: string; ticketId: string | null; lat: number; lng: number; at: string }
  | { type: "engineer.presence"; engineerId: string; online: boolean; lat: number | null; lng: number | null }
  | { type: "admin.unassigned"; ticketId: string; code: string }
  | { type: "requirement.updated"; requirementId: string; status: RequirementStatus }
  | { type: "requirement.invited"; requirementId: string; code: string; title: string }
  | { type: "requirement.question"; requirementId: string; questionId: string; answered: boolean }
  | { type: "quote.updated"; requirementId: string; quoteId: string; status: QuoteStatus };

/** Messages a client may send. */
export type ClientEvent =
  | { type: "subscribe"; ticketId: string }
  | { type: "unsubscribe"; ticketId: string }
  | { type: "subscribe"; requirementId: string }
  | { type: "unsubscribe"; requirementId: string }
  | { type: "ping" };
