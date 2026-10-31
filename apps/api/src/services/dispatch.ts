import { and, db, dispatchOffers, engineers, eq, inArray, isNull, ne, sql, ticketEvents, tickets } from "@amc/db";
import type { RingPayload } from "@amc/shared";
import { Queue, Worker } from "bullmq";
import { env } from "../env";
import { getDispatchConfig } from "../lib/config";
import { channels, notifyEngineer, publish, pushToEngineer } from "../lib/events";
import { conflict, notFound } from "../lib/http";
import { randomDigits } from "../lib/otp";
import { broadcastTicket, getTicket, SYSTEM, ticketCode, transition, type Ticket } from "./tickets";

const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null };

type WaveJob = { ticketId: string; round: number; wave: number };
type AutoCloseJob = { ticketId: string; resolvedAt: string };

export const dispatchQueue = new Queue("dispatch", { connection });

const waveJobId = (d: WaveJob) => `wave-${d.ticketId}-${d.round}-${d.wave}`;

/** Engineers on these statuses can't take another job. ON_HOLD (waiting for parts) doesn't block. */
const BUSY_STATUSES = ["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] as const;

async function enqueueWave(data: WaveJob, delayMs: number) {
  await dispatchQueue.add("wave", data, { jobId: waveJobId(data), delay: delayMs, removeOnComplete: 1000, removeOnFail: 1000 });
}

/** Runs the next wave now instead of waiting for the timeout (everyone in the current wave declined). */
async function promoteWave(data: WaveJob) {
  const job = await dispatchQueue.getJob(waveJobId(data));
  if (job && (await job.isDelayed())) await job.promote();
}

/** Starts a fresh dispatch round for a ticket that is in SEARCHING. */
export async function startDispatch(ticketId: string) {
  const cfg = await getDispatchConfig();
  const current = await getTicket(ticketId);
  const firstWave = current.priority === "urgent" && cfg.waves.length > 1 ? 1 : 0;
  const [t] = await db
    .update(tickets)
    .set({ dispatchRound: sql`${tickets.dispatchRound} + 1`, currentWave: firstWave })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "SEARCHING")))
    .returning();
  if (!t) return;
  await enqueueWave({ ticketId, round: t.dispatchRound, wave: firstWave }, 0);
}

type Candidate = { id: string; fcm_token: string | null; km: number };

async function findCandidates(t: Ticket, round: number, radiusKm: number, limit: number, staleMin: number): Promise<Candidate[]> {
  const rows = await db.execute<Candidate>(sql`
    select e.id, e.fcm_token, ST_Distance(e.last_location, s.location) / 1000 as km
    from engineers e
    join sites s on s.id = ${t.siteId}
    where e.status = 'approved'
      and e.is_online
      and e.last_location is not null
      and e.last_seen_at > now() - make_interval(mins => ${staleMin})
      and ${t.category}::category = any(e.skills)
      and (e.cooldown_until is null or e.cooldown_until < now())
      and ST_DWithin(e.last_location, s.location, least(${radiusKm}::float8, e.service_radius_km) * 1000)
      and not exists (
        select 1 from tickets busy
        where busy.engineer_id = e.id and busy.status in (${sql.join(BUSY_STATUSES.map((s) => sql`${s}`), sql`, `)})
      )
      and not exists (
        select 1 from dispatch_offers o
        where o.ticket_id = ${t.id} and o.engineer_id = e.id and (o.round = ${round} or o.response = 'accepted')
      )
      and not exists (
        select 1 from dispatch_offers ringing
        where ringing.engineer_id = e.id and ringing.response is null and ringing.expires_at > now()
      )
    order by km asc, e.rating_avg desc, e.acceptance_rate desc
    limit ${limit}
  `);
  return rows.map((r) => ({ ...r, km: Number(r.km) }));
}

async function runWave({ ticketId, round, wave }: WaveJob) {
  // Claim the wave: only one worker may run a given wave of a given round.
  const [t] = await db
    .update(tickets)
    .set({ currentWave: wave + 1 })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "SEARCHING"), eq(tickets.dispatchRound, round), eq(tickets.currentWave, wave)))
    .returning();
  if (!t) return;

  await withdrawOffers(ticketId, "timeout");

  const cfg = await getDispatchConfig();
  const w = cfg.waves[wave];
  if (!w) {
    await transition(ticketId, "UNASSIGNED", SYSTEM, { note: "No engineer accepted after all dispatch waves" });
    await publish([channels.admin], { type: "admin.unassigned", ticketId, code: ticketCode(t) });
    return;
  }

  const candidates = await findCandidates(t, round, w.radiusKm, w.maxEngineers, cfg.staleLocationMin);
  if (candidates.length === 0) {
    await enqueueWave({ ticketId, round, wave: wave + 1 }, 0);
    return;
  }

  const expiresAt = new Date(Date.now() + w.timeoutSec * 1000);
  const offers = await db
    .insert(dispatchOffers)
    .values(candidates.map((c) => ({ ticketId, engineerId: c.id, round, wave, distanceKm: c.km, expiresAt })))
    .returning();
  await db.insert(ticketEvents).values({
    ticketId,
    actorType: "system",
    note: `Wave ${wave + 1}: ringing ${offers.length} engineer${offers.length === 1 ? "" : "s"} within ${w.radiusKm} km`,
    meta: { round, wave, engineerIds: candidates.map((c) => c.id) },
  });

  await Promise.all(
    offers.map((offer, i) => {
      const ring: RingPayload = {
        offerId: offer.id,
        ticketId,
        code: ticketCode(t),
        category: t.category,
        priority: t.priority,
        title: t.title,
        distanceKm: Math.round(offer.distanceKm * 10) / 10,
        feeEstimate: t.feeEstimate,
        expiresAt: expiresAt.toISOString(),
        triage: t.triage,
      };
      return notifyEngineer({ id: offer.engineerId, fcmToken: candidates[i]!.fcm_token }, { type: "ring", ring }, w.timeoutSec);
    }),
  );

  await enqueueWave({ ticketId, round, wave: wave + 1 }, w.timeoutSec * 1000);
}

/** Closes all still-ringing offers for a ticket and tells those phones to stop ringing. */
export async function withdrawOffers(ticketId: string, response: "timeout" | "cancelled", reason: "taken" | "timeout" | "cancelled" = response) {
  const closed = await db
    .update(dispatchOffers)
    .set({ response, respondedAt: new Date() })
    .where(and(eq(dispatchOffers.ticketId, ticketId), isNull(dispatchOffers.response)))
    .returning();
  if (closed.length === 0) return;
  const engs = await db.query.engineers.findMany({
    where: inArray(
      engineers.id,
      closed.map((o) => o.engineerId),
    ),
    columns: { id: true, fcmToken: true },
  });
  await Promise.all(
    closed.map((o) => {
      const eng = engs.find((e) => e.id === o.engineerId) ?? { id: o.engineerId, fcmToken: null };
      return notifyEngineer(eng, { type: "ring.cancel", offerId: o.id, ticketId, reason });
    }),
  );
  if (response === "timeout") await Promise.all(closed.map((o) => recomputeAcceptance(o.engineerId)));
}

async function recomputeAcceptance(engineerId: string) {
  await db.execute(sql`
    update engineers set acceptance_rate = coalesce((
      select avg(case when response = 'accepted' then 1.0 else 0.0 end)
      from (
        select response from dispatch_offers
        where engineer_id = ${engineerId} and response in ('accepted', 'declined', 'timeout')
        order by sent_at desc limit 50
      ) recent
    ), 1)
    where id = ${engineerId}
  `);
}

async function assertEngineerFree(engineerId: string) {
  const busy = await db.query.tickets.findFirst({
    where: and(eq(tickets.engineerId, engineerId), inArray(tickets.status, [...BUSY_STATUSES])),
    columns: { id: true },
  });
  if (busy) throw conflict("Finish your current job before taking another", "engineer_busy");
}

const ACCEPT_GRACE_MS = 3000;

export async function acceptOffer(offerId: string, engineerId: string): Promise<Ticket> {
  const offer = await db.query.dispatchOffers.findFirst({
    where: and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.engineerId, engineerId)),
  });
  if (!offer) throw notFound("Request not found");
  if (offer.response) throw conflict(offer.response === "cancelled" ? "Another engineer took this job" : "This request has expired", "offer_closed");
  if (offer.expiresAt.getTime() + ACCEPT_GRACE_MS < Date.now()) throw conflict("This request has expired", "offer_closed");
  await assertEngineerFree(engineerId);

  const now = new Date();
  const assigned = await db.transaction(async (tx) => {
    const [t] = await tx
      .update(tickets)
      .set({ status: "ASSIGNED", engineerId, assignedAt: now, startOtp: randomDigits(4) })
      .where(and(eq(tickets.id, offer.ticketId), eq(tickets.status, "SEARCHING"), eq(tickets.dispatchRound, offer.round)))
      .returning();
    if (!t) return null;
    await tx.update(dispatchOffers).set({ response: "accepted", respondedAt: now }).where(eq(dispatchOffers.id, offerId));
    await tx.insert(ticketEvents).values({
      ticketId: t.id,
      actorType: "engineer",
      actorId: engineerId,
      fromStatus: "SEARCHING",
      toStatus: "ASSIGNED",
      meta: { offerId, wave: offer.wave, distanceKm: offer.distanceKm },
    });
    return t;
  });

  if (!assigned) {
    await db
      .update(dispatchOffers)
      .set({ response: "cancelled", respondedAt: now })
      .where(and(eq(dispatchOffers.id, offerId), isNull(dispatchOffers.response)));
    throw conflict("Another engineer took this job", "taken");
  }

  await withdrawOffers(assigned.id, "cancelled", "taken");
  await recomputeAcceptance(engineerId);
  await broadcastTicket(assigned);
  return assigned;
}

export async function declineOffer(offerId: string, engineerId: string) {
  const [offer] = await db
    .update(dispatchOffers)
    .set({ response: "declined", respondedAt: new Date() })
    .where(and(eq(dispatchOffers.id, offerId), eq(dispatchOffers.engineerId, engineerId), isNull(dispatchOffers.response)))
    .returning();
  if (!offer) return;
  await recomputeAcceptance(engineerId);
  const stillRinging = await db.$count(
    dispatchOffers,
    and(eq(dispatchOffers.ticketId, offer.ticketId), eq(dispatchOffers.round, offer.round), isNull(dispatchOffers.response), ne(dispatchOffers.id, offer.id)),
  );
  if (stillRinging === 0) await promoteWave({ ticketId: offer.ticketId, round: offer.round, wave: offer.wave + 1 });
}

/** Ops admin assigns an engineer directly (from SEARCHING or UNASSIGNED). */
export async function assignByAdmin(ticketId: string, engineerId: string, adminId: string): Promise<Ticket> {
  const engineer = await db.query.engineers.findFirst({ where: eq(engineers.id, engineerId) });
  if (!engineer || engineer.status !== "approved") throw conflict("Engineer is not approved");
  await assertEngineerFree(engineerId);
  const t = await transition(
    ticketId,
    "ASSIGNED",
    { type: "admin", id: adminId },
    { set: { engineerId, assignedAt: new Date(), startOtp: randomDigits(4) }, note: `Assigned to ${engineer.name} by ops` },
  );
  await withdrawOffers(ticketId, "cancelled", "taken");
  await pushToEngineer(engineer, { type: "ticket.updated", ticketId, status: "ASSIGNED" });
  return t;
}

export async function scheduleAutoClose(t: Ticket) {
  if (!t.resolvedAt) return;
  const cfg = await getDispatchConfig();
  const data: AutoCloseJob = { ticketId: t.id, resolvedAt: t.resolvedAt.toISOString() };
  await dispatchQueue.add("autoclose", data, {
    jobId: `autoclose-${t.id}-${t.resolvedAt.getTime()}`,
    delay: cfg.autoCloseHours * 3600 * 1000,
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}

async function runAutoClose({ ticketId, resolvedAt }: AutoCloseJob) {
  const t = await getTicket(ticketId);
  if (!["RESOLVED", "REMOTE_RESOLVED"].includes(t.status) || t.resolvedAt?.toISOString() !== resolvedAt) return;
  await transition(ticketId, "CLOSED", SYSTEM, { set: { closedAt: new Date() }, note: "Auto-closed — no response from company" });
}

export function startDispatchWorker() {
  const worker = new Worker(
    "dispatch",
    async (job) => {
      if (job.name === "wave") await runWave(job.data as WaveJob);
      else if (job.name === "autoclose") await runAutoClose(job.data as AutoCloseJob);
    },
    { connection, concurrency: 10 },
  );
  worker.on("failed", (job, err) => console.error(`[dispatch] job ${job?.name} ${job?.id} failed`, err));
  return worker;
}
