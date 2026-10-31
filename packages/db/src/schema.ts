import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { CATEGORIES, PROJECT_CATEGORIES, QUOTE_ITEM_KINDS, QUOTE_STATUSES, REQUIREMENT_STATUSES, TICKET_STATUSES, VENDOR_DOC_TYPES } from "@amc/shared";

export type LatLng = { lat: number; lng: number };

/** Parses PostGIS (E)WKB hex for a 2D point. */
function parsePointWkb(hex: string): LatLng {
  const buf = Buffer.from(hex, "hex");
  const le = buf.readUInt8(0) === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const offset = type & 0x20000000 ? 9 : 5;
  const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
  const y = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
  return { lng: x, lat: y };
}

/** geography(Point, 4326). Reads/writes { lat, lng }. */
export const geoPoint = customType<{ data: LatLng; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    return parsePointWkb(value);
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const categoryEnum = pgEnum("category", CATEGORIES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const priorityEnum = pgEnum("priority", ["normal", "urgent"]);
export const companyRoleEnum = pgEnum("company_role", ["admin", "user"]);
export const engineerStatusEnum = pgEnum("engineer_status", ["pending", "approved", "rejected", "suspended"]);
export const employmentTypeEnum = pgEnum("employment_type", ["freelance", "staff"]);
export const actorTypeEnum = pgEnum("actor_type", ["company", "engineer", "admin", "system"]);
export const offerResponseEnum = pgEnum("offer_response", ["accepted", "declined", "timeout", "cancelled"]);
export const mediaKindEnum = pgEnum("media_kind", ["issue", "before", "after"]);
export const kycDocTypeEnum = pgEnum("kyc_doc_type", ["aadhaar", "pan", "selfie", "other"]);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  gstin: text("gstin"),
  ...timestamps,
});

export const companyUsers = pgTable(
  "company_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    role: companyRoleEnum("role").notNull().default("user"),
    passwordHash: text("password_hash").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("company_users_email_idx").on(sql`lower(${t.email})`)],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    location: geoPoint("location").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    ...timestamps,
  },
  (t) => [index("sites_company_idx").on(t.companyId)],
);

export const engineers = pgTable(
  "engineers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull().default(""),
    photoKey: text("photo_key"),
    status: engineerStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("freelance"),
    skills: categoryEnum("skills").array().notNull().default(sql`'{}'`),
    serviceRadiusKm: integer("service_radius_km").notNull().default(15),
    isOnline: boolean("is_online").notNull().default(false),
    lastLocation: geoPoint("last_location"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    acceptanceRate: real("acceptance_rate").notNull().default(1),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    fcmToken: text("fcm_token"),
    ...timestamps,
  },
  (t) => [index("engineers_location_idx").using("gist", t.lastLocation), index("engineers_status_online_idx").on(t.status, t.isOnline)],
);

export const engineerKyc = pgTable("engineer_kyc", {
  id: uuid("id").primaryKey().defaultRandom(),
  engineerId: uuid("engineer_id")
    .notNull()
    .references(() => engineers.id, { onDelete: "cascade" }),
  docType: kycDocTypeEnum("doc_type").notNull(),
  fileKey: text("file_key").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by").references(() => admins.id),
  ...timestamps,
});

export const otpCodes = pgTable("otp_codes", {
  phone: text("phone").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    raisedBy: uuid("raised_by")
      .notNull()
      .references(() => companyUsers.id),
    category: categoryEnum("category").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    triage: jsonb("triage").$type<Record<string, string>>().notNull().default({}),
    status: ticketStatusEnum("status").notNull().default("OPEN"),
    engineerId: uuid("engineer_id").references(() => engineers.id),
    dispatchRound: integer("dispatch_round").notNull().default(0),
    currentWave: integer("current_wave").notNull().default(0),
    // Plain text by design: the company portal must display these. Never returned on engineer endpoints.
    startOtp: text("start_otp"),
    closeOtp: text("close_otp"),
    feeEstimate: integer("fee_estimate").notNull(),
    feeFinal: integer("fee_final"),
    paid: boolean("paid").notNull().default(false),
    ...timestamps,
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("tickets_status_idx").on(t.status),
    index("tickets_company_created_idx").on(t.companyId, t.createdAt),
    index("tickets_engineer_idx").on(t.engineerId),
  ],
);

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    fromStatus: ticketStatusEnum("from_status"),
    toStatus: ticketStatusEnum("to_status"),
    note: text("note"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const ticketMedia = pgTable(
  "ticket_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    uploaderType: actorTypeEnum("uploader_type").notNull(),
    uploaderId: uuid("uploader_id").notNull(),
    kind: mediaKindEnum("kind").notNull(),
    fileKey: text("file_key").notNull().unique(),
    ...timestamps,
  },
  (t) => [index("ticket_media_ticket_idx").on(t.ticketId)],
);

export const ticketParts = pgTable("ticket_parts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  needsApproval: boolean("needs_approval").notNull(),
  approvedBy: uuid("approved_by").references(() => companyUsers.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  ...timestamps,
});

export const dispatchOffers = pgTable(
  "dispatch_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    engineerId: uuid("engineer_id")
      .notNull()
      .references(() => engineers.id),
    round: integer("round").notNull(),
    wave: integer("wave").notNull(),
    distanceKm: real("distance_km").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    response: offerResponseEnum("response"),
  },
  (t) => [index("dispatch_offers_ticket_idx").on(t.ticketId), index("dispatch_offers_engineer_idx").on(t.engineerId, t.sentAt)],
);

export const locationPings = pgTable(
  "location_pings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    engineerId: uuid("engineer_id")
      .notNull()
      .references(() => engineers.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    location: geoPoint("location").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("location_pings_ticket_idx").on(t.ticketId, t.recordedAt)],
);

export const ratings = pgTable(
  "ratings",
  {
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fromType: actorTypeEnum("from_type").notNull(),
    score: integer("score").notNull(),
    comment: text("comment").notNull().default(""),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.fromType] })],
);

export const dispatchConfig = pgTable("dispatch_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Project quotations (RFQ marketplace) — see docs/SPEC.md §14
// ---------------------------------------------------------------------------

export const projectCategoryEnum = pgEnum("project_category", PROJECT_CATEGORIES);
export const vendorStatusEnum = pgEnum("vendor_status", ["pending", "approved", "rejected", "suspended"]);
export const vendorRoleEnum = pgEnum("vendor_role", ["admin", "member"]);
export const vendorDocTypeEnum = pgEnum("vendor_doc_type", VENDOR_DOC_TYPES);
export const requirementStatusEnum = pgEnum("requirement_status", REQUIREMENT_STATUSES);
export const quoteStatusEnum = pgEnum("quote_status", QUOTE_STATUSES);
export const quoteItemKindEnum = pgEnum("quote_item_kind", QUOTE_ITEM_KINDS);
export const rfqActorTypeEnum = pgEnum("rfq_actor_type", ["company", "vendor", "admin", "system"]);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    gstin: text("gstin").notNull().unique(),
    status: vendorStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    categories: projectCategoryEnum("categories").array().notNull().default(sql`'{}'`),
    // State names, or 'ALL' for the whole of India.
    states: text("states").array().notNull().default(sql`'{}'`),
    city: text("city").notNull().default(""),
    description: text("description").notNull().default(""),
    website: text("website").notNull().default(""),
    certifications: text("certifications").array().notNull().default(sql`'{}'`),
    teamSize: integer("team_size"),
    foundedYear: integer("founded_year"),
    subscriptionUntil: timestamp("subscription_until", { withTimezone: true }),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    isEarthclique: boolean("is_earthclique").notNull().default(false),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("vendors_status_idx").on(t.status)],
);

export const vendorUsers = pgTable(
  "vendor_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    role: vendorRoleEnum("role").notNull().default("member"),
    passwordHash: text("password_hash").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("vendor_users_email_idx").on(sql`lower(${t.email})`)],
);

export const vendorDocuments = pgTable("vendor_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  docType: vendorDocTypeEnum("doc_type").notNull(),
  fileKey: text("file_key").notNull().unique(),
  label: text("label").notNull().default(""),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by").references(() => admins.id),
  ...timestamps,
});

export const requirements = pgTable(
  "requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull().unique(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    raisedBy: uuid("raised_by")
      .notNull()
      .references(() => companyUsers.id),
    category: projectCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    spec: jsonb("spec").$type<Record<string, string | number | boolean | string[]>>().notNull().default({}),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    quoteDeadline: timestamp("quote_deadline", { withTimezone: true }).notNull(),
    startBy: date("start_by"),
    surveyAllowed: boolean("survey_allowed").notNull().default(true),
    status: requirementStatusEnum("status").notNull().default("SUBMITTED"),
    rejectionReason: text("rejection_reason"),
    // Copied from the site at creation so matching doesn't depend on geocoding.
    state: text("state").notNull(),
    city: text("city").notNull(),
    maxQuotes: integer("max_quotes").notNull(),
    awardedQuoteId: uuid("awarded_quote_id"),
    ...timestamps,
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("requirements_company_idx").on(t.companyId, t.createdAt), index("requirements_status_idx").on(t.status)],
);

export const requirementAttachments = pgTable("requirement_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id")
    .notNull()
    .references(() => requirements.id, { onDelete: "cascade" }),
  fileKey: text("file_key").notNull().unique(),
  name: text("name").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  ...timestamps,
});

export const requirementVendors = pgTable(
  "requirement_vendors",
  {
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    matchRank: integer("match_rank").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.requirementId, t.vendorId] }), index("requirement_vendors_vendor_idx").on(t.vendorId, t.invitedAt)],
);

export const requirementQuestions = pgTable(
  "requirement_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer"),
    answeredBy: uuid("answered_by").references(() => companyUsers.id),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("requirement_questions_req_idx").on(t.requirementId, t.createdAt)],
);

export const requirementEvents = pgTable(
  "requirement_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    actorType: rfqActorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    fromStatus: requirementStatusEnum("from_status"),
    toStatus: requirementStatusEnum("to_status"),
    note: text("note"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("requirement_events_req_idx").on(t.requirementId, t.createdAt)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    version: integer("version").notNull().default(1),
    status: quoteStatusEnum("status").notNull().default("DRAFT"),
    subtotal: integer("subtotal").notNull().default(0),
    gstTotal: integer("gst_total").notNull().default(0),
    total: integer("total").notNull().default(0),
    timelineDays: integer("timeline_days"),
    warrantyMonths: integer("warranty_months"),
    paymentTerms: text("payment_terms").notNull().default(""),
    validUntil: date("valid_until"),
    notes: text("notes").notNull().default(""),
    surveyRequired: boolean("survey_required").notNull().default(false),
    revisionNote: text("revision_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("quotes_requirement_vendor_idx").on(t.requirementId, t.vendorId), index("quotes_vendor_idx").on(t.vendorId, t.updatedAt)],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    sort: integer("sort").notNull(),
    kind: quoteItemKindEnum("kind").notNull(),
    description: text("description").notNull(),
    brandModel: text("brand_model").notNull().default(""),
    qty: real("qty").notNull(),
    unit: text("unit").notNull().default("nos"),
    unitPrice: integer("unit_price").notNull(),
    gstPercent: integer("gst_percent").notNull(),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId, t.sort)],
);
