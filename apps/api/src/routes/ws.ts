import { and, db, eq, requirementVendors, requirements, tickets } from "@amc/db";
import type { ClientEvent } from "@amc/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, type AuthUser } from "../lib/auth";
import { channels, hub } from "../lib/events";
import { parse } from "../lib/http";

const query = z.object({ as: z.enum(["engineer", "company", "vendor", "admin"]) });

async function canWatchTicket(user: AuthUser, ticketId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "vendor") return false;
  const t = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId), columns: { companyId: true, engineerId: true } });
  if (!t) return false;
  return user.role === "company" ? t.companyId === user.companyId : t.engineerId === user.sub;
}

async function canWatchRequirement(user: AuthUser, requirementId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "company") {
    const r = await db.query.requirements.findFirst({ where: eq(requirements.id, requirementId), columns: { companyId: true } });
    return r?.companyId === user.companyId;
  }
  if (user.role !== "vendor") return false;
  const invite = await db.query.requirementVendors.findFirst({ where: and(eq(requirementVendors.requirementId, requirementId), eq(requirementVendors.vendorId, user.vendorId)) });
  return !!invite;
}

/**
 * Real-time channel. Engineers authenticate with a Bearer header; the web portal uses its session cookie.
 * Each user is joined to their own channel; ticket channels are joined via { type: "subscribe" }.
 */
export async function wsRoutes(app: FastifyInstance) {
  app.get(
    "/ws",
    {
      websocket: true,
      preValidation: async (req) => {
        authenticate(req, parse(query, req.query).as);
      },
    },
    (socket, req) => {
      const user = req.user;
      if (user.role === "engineer") hub.join(channels.engineer(user.sub), socket);
      if (user.role === "company") hub.join(channels.company(user.companyId), socket);
      if (user.role === "vendor") hub.join(channels.vendor(user.vendorId), socket);
      if (user.role === "admin") hub.join(channels.admin, socket);

      socket.on("message", async (raw) => {
        let msg: ClientEvent;
        try {
          msg = JSON.parse(raw.toString()) as ClientEvent;
        } catch {
          return;
        }
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        } else if (msg.type === "subscribe" && "ticketId" in msg && z.uuid().safeParse(msg.ticketId).success) {
          if (await canWatchTicket(user, msg.ticketId)) hub.join(channels.ticket(msg.ticketId), socket);
        } else if (msg.type === "subscribe" && "requirementId" in msg && z.uuid().safeParse(msg.requirementId).success) {
          if (await canWatchRequirement(user, msg.requirementId)) hub.join(channels.requirement(msg.requirementId), socket);
        } else if (msg.type === "unsubscribe") {
          hub.leave("ticketId" in msg ? channels.ticket(msg.ticketId) : channels.requirement(msg.requirementId), socket);
        }
      });

      socket.on("close", () => hub.leaveAll(socket));
    },
  );
}
