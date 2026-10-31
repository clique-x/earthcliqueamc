import { DEFAULT_DISPATCH_CONFIG, DEFAULT_RFQ_CONFIG } from "@amc/shared";
import { db, sqlClient } from "./client";
import { hashPassword } from "./password";
import { admins, companies, companyUsers, dispatchConfig, engineers, sites, vendorUsers, vendors } from "./schema";

const env = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
};

if (process.env.NODE_ENV === "production") throw new Error("Seed is for development only");

const lat = Number(env("SEED_LAT"));
const lng = Number(env("SEED_LNG"));

await db
  .insert(dispatchConfig)
  .values([
    { key: "dispatch", value: DEFAULT_DISPATCH_CONFIG },
    { key: "rfq", value: DEFAULT_RFQ_CONFIG },
  ])
  .onConflictDoNothing();

await db
  .insert(admins)
  .values({ name: "Ops Admin", email: env("SEED_ADMIN_EMAIL"), passwordHash: await hashPassword(env("SEED_ADMIN_PASSWORD")) })
  .onConflictDoNothing();

const existing = await db.query.companyUsers.findFirst({ where: (u, { eq }) => eq(u.email, env("SEED_COMPANY_EMAIL")) });
if (!existing) {
  const [company] = await db.insert(companies).values({ name: "Acme Textiles (demo)" }).returning();
  await db.insert(companyUsers).values({
    companyId: company!.id,
    name: "Demo Admin",
    email: env("SEED_COMPANY_EMAIL"),
    phone: "9876500000",
    role: "admin",
    passwordHash: await hashPassword(env("SEED_COMPANY_PASSWORD")),
  });
  await db.insert(sites).values({
    companyId: company!.id,
    label: "Head office",
    address: "Plot 12, GIDC Estate, Ahmedabad, Gujarat 382330",
    location: { lat, lng },
    contactName: "Front desk",
    contactPhone: "9876500001",
  });
}

// Demo engineers at ~1.5 km, ~4 km and ~8 km from the seed point so dispatch waves can be exercised.
const demoEngineers = [
  { phone: "9000000001", name: "Ravi (demo)", skills: ["pc", "network"] as const, dLat: 0.012, dLng: 0.008 },
  { phone: "9000000002", name: "Imran (demo)", skills: ["pc", "cctv"] as const, dLat: -0.03, dLng: 0.02 },
  { phone: "9000000003", name: "Suresh (demo)", skills: ["network", "cctv"] as const, dLat: 0.06, dLng: -0.04 },
];
for (const e of demoEngineers) {
  await db
    .insert(engineers)
    .values({
      phone: e.phone,
      name: e.name,
      status: "approved",
      skills: [...e.skills],
      serviceRadiusKm: 20,
      lastLocation: { lat: lat + e.dLat, lng: lng + e.dLng },
    })
    .onConflictDoNothing();
}

// Demo vendors for the quotations marketplace: one verified and subscribed, one still pending.
const demoVendors = [
  {
    name: "NetSecure Systems (demo)",
    gstin: "24AAACN1234A1Z5",
    status: "approved" as const,
    categories: ["cctv", "network", "servers"] as const,
    states: ["Gujarat", "Maharashtra", "Rajasthan"],
    city: "Ahmedabad",
    description: "CCTV and networking integrator since 2012. Hikvision and Cisco partner.",
    certifications: ["Hikvision Certified Partner", "Cisco Select Partner"],
    teamSize: 24,
    foundedYear: 2012,
    subscriptionUntil: new Date(Date.now() + 365 * 86400_000),
    ratingAvg: 4.6,
    ratingCount: 12,
    user: { name: "Nilesh Shah", email: env("SEED_VENDOR_EMAIL"), phone: "9876511111", password: env("SEED_VENDOR_PASSWORD") },
  },
  {
    name: "DataCore Infra (demo)",
    gstin: "27AABCD5678B1Z3",
    status: "approved" as const,
    categories: ["servers", "datacenter"] as const,
    states: ["ALL"],
    city: "Pune",
    description: "Server rooms and data centre builds across India.",
    certifications: ["Dell Technologies Partner"],
    teamSize: 40,
    foundedYear: 2009,
    subscriptionUntil: new Date(Date.now() + 365 * 86400_000),
    ratingAvg: 4.2,
    ratingCount: 5,
    user: { name: "Priya Menon", email: "priya@datacore.test", phone: "9876522222", password: "vendor12345" },
  },
  {
    name: "QuickFix IT (demo)",
    gstin: "07AAAQF9012C1Z9",
    status: "pending" as const,
    categories: ["network"] as const,
    states: ["Delhi"],
    city: "New Delhi",
    description: "",
    certifications: [],
    teamSize: 6,
    foundedYear: 2020,
    subscriptionUntil: null,
    ratingAvg: 0,
    ratingCount: 0,
    user: { name: "Arjun Verma", email: "arjun@quickfix.test", phone: "9876533333", password: "vendor12345" },
  },
];
for (const v of demoVendors) {
  const { user, ...vendor } = v;
  const [row] = await db
    .insert(vendors)
    .values({ ...vendor, categories: [...vendor.categories] })
    .onConflictDoNothing()
    .returning();
  if (!row) continue;
  const { password, ...profile } = user;
  await db.insert(vendorUsers).values({ vendorId: row.id, ...profile, role: "admin", passwordHash: await hashPassword(password) });
}

console.log("Seed complete");
await sqlClient.end();
