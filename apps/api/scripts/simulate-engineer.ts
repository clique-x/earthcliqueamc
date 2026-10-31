/**
 * Dev tool: behaves like an engineer's phone so the dispatch flow can be tested without a device.
 * Logs in with the dev OTP, goes online, listens for rings, optionally auto-accepts and drives to the site.
 *
 *   pnpm simulate:engineer --phone 9000000001 --accept --drive
 */
import type { RingPayload, ServerEvent } from "@amc/shared";
import { parseArgs } from "node:util";
import WebSocket from "ws";

const { values } = parseArgs({
  options: {
    phone: { type: "string", default: "9000000001" },
    api: { type: "string", default: "http://localhost:4000" },
    accept: { type: "boolean", default: false },
    decline: { type: "boolean", default: false },
    drive: { type: "boolean", default: false },
    "accept-delay": { type: "string", default: "2" },
  },
});

const API = values.api!;
let token = "";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.message ?? ""}`);
  return data;
}

const log = (...args: unknown[]) => console.log(`[${values.phone} ${new Date().toLocaleTimeString()}]`, ...args);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { devCode } = await call<{ devCode?: string }>("POST", "/auth/engineer/otp/request", { phone: values.phone });
if (!devCode) throw new Error("No dev OTP returned — is SMS_PROVIDER=console and NODE_ENV not production?");
({ token } = await call<{ token: string }>("POST", "/auth/engineer/otp/verify", { phone: values.phone, code: devCode }));

const me = await call<{ name: string; status: string; lastLocation: { lat: number; lng: number } | null }>("GET", "/engineer/me");
if (!me.lastLocation) throw new Error("Engineer has no location — run pnpm db:seed");
let position = me.lastLocation;
await call("POST", "/engineer/online", { online: true, ...position });
log(`${me.name} is online at ${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);

setInterval(() => void call("POST", "/engineer/location", position).catch((e) => log("heartbeat failed", e.message)), 60_000);

async function drive(ticketId: string) {
  const job = await call<{ site: { lat: number; lng: number; address: string } }>("GET", `/engineer/jobs/${ticketId}`);
  await call("POST", `/engineer/jobs/${ticketId}/start-journey`);
  log(`Driving to ${job.site.address}`);
  const steps = 10;
  const start = position;
  for (let i = 1; i <= steps; i++) {
    await sleep(2000);
    position = { lat: start.lat + ((job.site.lat - start.lat) * i) / steps, lng: start.lng + ((job.site.lng - start.lng) * i) / steps };
    await call("POST", "/engineer/location", position);
    log(`  moved ${i}/${steps}`);
  }
  log("Arrived — enter the start OTP from the company portal to begin work");
}

async function onRing(ring: RingPayload) {
  log(`RING ${ring.code} [${ring.category}] "${ring.title}" ${ring.distanceKm} km, ₹${ring.feeEstimate}`);
  if (values.decline) {
    await call("POST", `/engineer/offers/${ring.offerId}/decline`);
    log("Declined");
    return;
  }
  if (!values.accept) return;
  await sleep(Number(values["accept-delay"]) * 1000);
  try {
    const { ticketId } = await call<{ ticketId: string }>("POST", `/engineer/offers/${ring.offerId}/accept`);
    log(`Accepted ${ring.code}`);
    if (values.drive) await drive(ticketId);
  } catch (e) {
    log("Accept failed:", (e as Error).message);
  }
}

function connect() {
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/ws?as=engineer`, { headers: { authorization: `Bearer ${token}` } });
  ws.on("open", () => log("Listening for rings"));
  ws.on("message", (raw) => {
    const event = JSON.parse(raw.toString()) as ServerEvent | { type: "pong" };
    if (event.type === "ring") void onRing(event.ring);
    else if (event.type === "ring.cancel") log(`Ring for ${event.ticketId.slice(0, 8)} stopped (${event.reason})`);
    else if (event.type === "ticket.updated") log(`Ticket ${event.ticketId.slice(0, 8)} → ${event.status}`);
  });
  ws.on("close", () => {
    log("Disconnected — reconnecting");
    setTimeout(connect, 2000);
  });
  ws.on("error", (e) => log("ws error", e.message));
}
connect();

async function goOffline() {
  await call("POST", "/engineer/online", { online: false, ...position }).catch(() => {});
  log("Offline");
  process.exit(0);
}
process.on("SIGINT", goOffline);
process.on("SIGTERM", goOffline);
