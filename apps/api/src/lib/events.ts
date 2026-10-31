import type { ServerEvent } from "@amc/shared";
import { Redis } from "ioredis";
import type { WebSocket } from "ws";
import { env } from "../env";
import { sendPush } from "./push";

const CHANNEL = "amc:events";

export const channels = {
  engineer: (id: string) => `engineer:${id}`,
  ticket: (id: string) => `ticket:${id}`,
  company: (id: string) => `company:${id}`,
  vendor: (id: string) => `vendor:${id}`,
  requirement: (id: string) => `requirement:${id}`,
  admin: "admin",
};

const publisher = new Redis(env.REDIS_URL);

/** Publishes an event to channels across all API instances (Redis pub/sub). */
export async function publish(targets: string[], event: ServerEvent): Promise<void> {
  await publisher.publish(CHANNEL, JSON.stringify({ targets, event }));
}

type EngineerTarget = { id: string; fcmToken: string | null };

/** Sends a WebSocket event and, if the engineer has an FCM token, a push (for when the app is backgrounded). */
export async function notifyEngineer(engineer: EngineerTarget, event: ServerEvent, ttlSec = 60) {
  await publish([channels.engineer(engineer.id)], event);
  await pushToEngineer(engineer, event, ttlSec);
}

/** Push only — for events the WebSocket already carries via broadcastTicket. */
export async function pushToEngineer(engineer: EngineerTarget, event: ServerEvent, ttlSec = 60) {
  if (engineer.fcmToken) await sendPush(engineer.fcmToken, event, ttlSec);
}

/** Local registry of sockets on this instance. */
class Hub {
  private subs = new Map<string, Set<WebSocket>>();

  join(channel: string, socket: WebSocket) {
    let set = this.subs.get(channel);
    if (!set) this.subs.set(channel, (set = new Set()));
    set.add(socket);
  }

  leave(channel: string, socket: WebSocket) {
    const set = this.subs.get(channel);
    set?.delete(socket);
    if (set?.size === 0) this.subs.delete(channel);
  }

  leaveAll(socket: WebSocket) {
    for (const channel of this.subs.keys()) this.leave(channel, socket);
  }

  deliver(targets: string[], event: ServerEvent) {
    const payload = JSON.stringify(event);
    const sent = new Set<WebSocket>();
    for (const target of targets) {
      for (const socket of this.subs.get(target) ?? []) {
        if (sent.has(socket) || socket.readyState !== socket.OPEN) continue;
        socket.send(payload);
        sent.add(socket);
      }
    }
  }
}

export const hub = new Hub();

let subscriber: Redis | null = null;

export async function startEventSubscriber() {
  subscriber = new Redis(env.REDIS_URL);
  await subscriber.subscribe(CHANNEL);
  subscriber.on("message", (_channel, message) => {
    const { targets, event } = JSON.parse(message) as { targets: string[]; event: ServerEvent };
    hub.deliver(targets, event);
  });
}

export async function closeEvents() {
  await subscriber?.quit();
  await publisher.quit();
}
