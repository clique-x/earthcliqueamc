import { createHash, randomInt } from "node:crypto";
import { db, eq, otpCodes, sql } from "@amc/db";
import { env } from "../env";
import { HttpError, unauthorized } from "./http";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}:${env.JWT_SECRET}`).digest("hex");

export function randomDigits(length: number): string {
  return Array.from({ length }, () => randomInt(0, 10)).join("");
}

interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

// Dev-only provider: prints the code to the API log. A real provider (MSG91 / Twilio Verify)
// needs DLT template registration and is planned for Phase 2.
const consoleProvider: SmsProvider = {
  async sendOtp(phone, code) {
    console.info(`[sms:console] OTP for ${phone}: ${code}`);
  },
};

const provider: SmsProvider = consoleProvider;

/** Creates and sends a login OTP. Returns the code only for the console provider (dev). */
export async function issueLoginOtp(phone: string): Promise<string | undefined> {
  const code = randomDigits(6);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db
    .insert(otpCodes)
    .values({ phone, codeHash: hash(phone, code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({ target: otpCodes.phone, set: { codeHash: hash(phone, code), expiresAt, attempts: 0 } });
  await provider.sendOtp(phone, code);
  return env.SMS_PROVIDER === "console" && env.NODE_ENV !== "production" ? code : undefined;
}

export async function consumeLoginOtp(phone: string, code: string): Promise<void> {
  const [row] = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(eq(otpCodes.phone, phone))
    .returning();
  if (!row || row.expiresAt < new Date()) throw unauthorized("Code expired — request a new one");
  if (row.attempts > MAX_ATTEMPTS) throw new HttpError(429, "Too many attempts — request a new code");
  if (row.codeHash !== hash(phone, code)) throw unauthorized("Incorrect code");
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
}
