import { db, dispatchConfig, eq } from "@amc/db";
import { DEFAULT_DISPATCH_CONFIG, DEFAULT_RFQ_CONFIG, dispatchConfigSchema, rfqConfigSchema, type DispatchConfig, type RfqConfig } from "@amc/shared";

let cached: { value: DispatchConfig; at: number } | null = null;
const CACHE_MS = 10_000;

export async function getDispatchConfig(): Promise<DispatchConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const row = await db.query.dispatchConfig.findFirst({ where: eq(dispatchConfig.key, "dispatch") });
  const parsed = dispatchConfigSchema.safeParse(row?.value);
  const value = parsed.success ? parsed.data : DEFAULT_DISPATCH_CONFIG;
  cached = { value, at: Date.now() };
  return value;
}

export async function setDispatchConfig(value: DispatchConfig) {
  await db
    .insert(dispatchConfig)
    .values({ key: "dispatch", value })
    .onConflictDoUpdate({ target: dispatchConfig.key, set: { value, updatedAt: new Date() } });
  cached = { value, at: Date.now() };
}

let rfqCached: { value: RfqConfig; at: number } | null = null;

export async function getRfqConfig(): Promise<RfqConfig> {
  if (rfqCached && Date.now() - rfqCached.at < CACHE_MS) return rfqCached.value;
  const row = await db.query.dispatchConfig.findFirst({ where: eq(dispatchConfig.key, "rfq") });
  const parsed = rfqConfigSchema.safeParse(row?.value);
  const value = parsed.success ? parsed.data : DEFAULT_RFQ_CONFIG;
  rfqCached = { value, at: Date.now() };
  return value;
}

export async function setRfqConfig(value: RfqConfig) {
  await db
    .insert(dispatchConfig)
    .values({ key: "rfq", value })
    .onConflictDoUpdate({ target: dispatchConfig.key, set: { value, updatedAt: new Date() } });
  rfqCached = { value, at: Date.now() };
}
