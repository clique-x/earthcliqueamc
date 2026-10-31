import { and, db, eq, ticketEvents, tickets } from "@amc/db";
import { canTransition, STATUS_LABELS, type ActorType, type TicketStatus } from "@amc/shared";
import { channels, publish } from "../lib/events";
import { conflict, notFound } from "../lib/http";

export type Ticket = typeof tickets.$inferSelect;
export type Actor = { type: ActorType; id: string | null };

export const SYSTEM: Actor = { type: "system", id: null };

export const ticketCode = (t: Pick<Ticket, "number">) => `EC-${10000 + t.number}`;

export async function getTicket(id: string): Promise<Ticket> {
  const t = await db.query.tickets.findFirst({ where: eq(tickets.id, id) });
  if (!t) throw notFound("Ticket not found");
  return t;
}

type TransitionOptions = {
  set?: Partial<typeof tickets.$inferInsert>;
  note?: string;
  meta?: Record<string, unknown>;
};

/**
 * Moves a ticket to a new status if the state machine allows it for this actor.
 * The update is conditional on the status we read, so concurrent changes fail with 409.
 */
export async function transition(ticketId: string, to: TicketStatus, actor: Actor, opts: TransitionOptions = {}): Promise<Ticket> {
  const current = await getTicket(ticketId);
  if (!canTransition(current.status, to, actor.type)) {
    throw conflict(`Ticket is "${STATUS_LABELS[current.status]}" — this action isn't available now`, "invalid_transition");
  }
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(tickets)
      .set({ ...opts.set, status: to })
      .where(and(eq(tickets.id, ticketId), eq(tickets.status, current.status)))
      .returning();
    if (!row) return null;
    await tx.insert(ticketEvents).values({
      ticketId,
      actorType: actor.type,
      actorId: actor.id,
      fromStatus: current.status,
      toStatus: to,
      note: opts.note || null,
      meta: opts.meta ?? {},
    });
    return row;
  });
  if (!updated) throw conflict("Ticket was just updated — refresh and try again");
  await broadcastTicket(updated, current.engineerId);
  return updated;
}

/** Records a non-status event (photo added, part added, failed OTP...) on the timeline and tells open views to refresh. */
export async function logEvent(ticketId: string, actor: Actor, note: string, meta: Record<string, unknown> = {}) {
  await db.insert(ticketEvents).values({ ticketId, actorType: actor.type, actorId: actor.id, note, meta });
  await broadcastTicket(await getTicket(ticketId));
}

export async function broadcastTicket(t: Ticket, previousEngineerId?: string | null) {
  const targets = [channels.ticket(t.id), channels.company(t.companyId), channels.admin];
  for (const id of new Set([t.engineerId, previousEngineerId])) if (id) targets.push(channels.engineer(id));
  await publish(targets, { type: "ticket.updated", ticketId: t.id, status: t.status });
}
