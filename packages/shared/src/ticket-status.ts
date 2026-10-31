export const TICKET_STATUSES = [
  "OPEN",
  "SEARCHING",
  "UNASSIGNED",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "ON_HOLD",
  "RESOLVED",
  "REMOTE_RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type ActorType = "company" | "engineer" | "admin" | "system";

/**
 * Single source of truth for allowed status changes and who may make them.
 * The API rejects any transition not listed here.
 */
export const TRANSITIONS: Record<TicketStatus, Partial<Record<TicketStatus, ActorType[]>>> = {
  OPEN: { SEARCHING: ["system"], CANCELLED: ["company", "admin"] },
  SEARCHING: {
    ASSIGNED: ["engineer", "admin"],
    UNASSIGNED: ["system"],
    CANCELLED: ["company", "admin"],
  },
  UNASSIGNED: {
    SEARCHING: ["admin"],
    ASSIGNED: ["admin"],
    CANCELLED: ["company", "admin"],
  },
  ASSIGNED: {
    EN_ROUTE: ["engineer"],
    REMOTE_RESOLVED: ["engineer"],
    SEARCHING: ["engineer", "admin"],
    CANCELLED: ["company", "admin"],
  },
  EN_ROUTE: {
    ARRIVED: ["engineer"],
    REMOTE_RESOLVED: ["engineer"],
    SEARCHING: ["engineer", "admin"],
    CANCELLED: ["company", "admin"],
  },
  ARRIVED: { IN_PROGRESS: ["engineer"] },
  IN_PROGRESS: { ON_HOLD: ["engineer"], RESOLVED: ["engineer"] },
  ON_HOLD: { IN_PROGRESS: ["engineer"], CANCELLED: ["admin"] },
  RESOLVED: { CLOSED: ["company", "engineer", "system", "admin"], IN_PROGRESS: ["company"] },
  REMOTE_RESOLVED: { CLOSED: ["company", "system", "admin"], SEARCHING: ["company"] },
  CLOSED: {},
  CANCELLED: {},
};

export function canTransition(from: TicketStatus, to: TicketStatus, actor: ActorType): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** Statuses during which an engineer is committed to a ticket. */
export const ACTIVE_ENGINEER_STATUSES: TicketStatus[] = [
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "ON_HOLD",
];

export const OPEN_STATUSES: TicketStatus[] = ["OPEN", "SEARCHING", "UNASSIGNED", ...ACTIVE_ENGINEER_STATUSES];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  SEARCHING: "Finding engineer",
  UNASSIGNED: "No engineer found",
  ASSIGNED: "Engineer assigned",
  EN_ROUTE: "On the way",
  ARRIVED: "Arrived",
  IN_PROGRESS: "Work in progress",
  ON_HOLD: "On hold",
  RESOLVED: "Resolved — awaiting confirmation",
  REMOTE_RESOLVED: "Fixed remotely — awaiting confirmation",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};
