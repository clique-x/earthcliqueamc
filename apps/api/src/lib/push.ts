import type { ServerEvent } from "@amc/shared";
import { cert, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../env";

let app: App | null = null;

if (env.FIREBASE_SERVICE_ACCOUNT) {
  app = initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
} else {
  console.warn("[push] FIREBASE_SERVICE_ACCOUNT not set — rings go over WebSocket only (engineer app must be running)");
}

/** High-priority FCM data message so the engineer app can ring even when backgrounded. */
export async function sendPush(token: string, event: ServerEvent, ttlSec: number) {
  if (!app) return;
  try {
    await getMessaging(app).send({
      token,
      data: { type: event.type, payload: JSON.stringify(event) },
      android: { priority: "high", ttl: ttlSec * 1000 },
    });
  } catch (err) {
    console.error("[push] FCM send failed", err);
  }
}
