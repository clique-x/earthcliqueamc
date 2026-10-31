import { z } from "zod";
import { ALL_INDIA, INDIAN_STATES, PROJECT_CATEGORIES, PROJECT_CATEGORY_INFO, type ProjectCategory } from "./project-categories";
import { GST_RATES, QUOTE_ITEM_KINDS } from "./requirement-status";

const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number");
const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z\d]$/, "Enter a valid 15-character GSTIN");
const stateName = z.enum(INDIAN_STATES);

export const vendorSignupSchema = z.object({
  vendorName: z.string().trim().min(2).max(120),
  gstin,
  city: z.string().trim().min(2).max(80),
  state: stateName,
  categories: z.array(z.enum(PROJECT_CATEGORIES)).min(1),
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone,
  password: z.string().min(8).max(100),
});

export const vendorProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  categories: z.array(z.enum(PROJECT_CATEGORIES)).min(1),
  states: z.array(z.union([stateName, z.literal(ALL_INDIA)])).min(1),
  description: z.string().trim().max(2000).default(""),
  website: z.string().trim().max(200).default(""),
  certifications: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  teamSize: z.number().int().min(1).max(100_000).nullable().default(null),
  foundedYear: z.number().int().min(1950).max(2100).nullable().default(null),
});

export const vendorUserCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone,
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "member"]),
});

export const VENDOR_DOC_TYPES = ["gst", "pan", "registration", "certification", "other"] as const;

const specValue = z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.array(z.string().max(100)).max(20)]);

/** Validates a spec against the category's field definitions: required fields present, numbers numeric, options known. */
export function validateSpec(category: ProjectCategory, spec: Record<string, unknown>): { ok: true; spec: Record<string, z.infer<typeof specValue>> } | { ok: false; message: string } {
  const out: Record<string, z.infer<typeof specValue>> = {};
  for (const f of PROJECT_CATEGORY_INFO[category].fields) {
    const raw = spec[f.id];
    const empty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (f.required) return { ok: false, message: `${f.label} is required` };
      continue;
    }
    switch (f.type) {
      case "number": {
        const n = typeof raw === "string" ? Number(raw) : raw;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return { ok: false, message: `${f.label} must be a number` };
        out[f.id] = n;
        break;
      }
      case "boolean":
        out[f.id] = raw === true || raw === "true" || raw === "yes";
        break;
      case "select":
        if (typeof raw !== "string" || !f.options!.includes(raw)) return { ok: false, message: `Choose a valid option for ${f.label}` };
        out[f.id] = raw;
        break;
      case "multiselect": {
        if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !f.options!.includes(v))) {
          return { ok: false, message: `Choose valid options for ${f.label}` };
        }
        out[f.id] = raw as string[];
        break;
      }
      case "text":
        if (typeof raw !== "string") return { ok: false, message: `${f.label} must be text` };
        out[f.id] = raw.trim().slice(0, 1000);
        break;
    }
  }
  return { ok: true, spec: out };
}

export const requirementCreateSchema = z.object({
  siteId: z.uuid(),
  category: z.enum(PROJECT_CATEGORIES),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().max(5000).default(""),
  spec: z.record(z.string(), z.unknown()).default({}),
  quoteDeadline: z.iso.datetime({ offset: true }),
  startBy: z.iso.date().nullable().default(null),
  budgetMin: z.number().int().min(0).nullable().default(null),
  budgetMax: z.number().int().min(0).nullable().default(null),
  surveyAllowed: z.boolean().default(true),
});

export const questionAskSchema = z.object({ question: z.string().trim().min(5).max(1000) });
export const questionAnswerSchema = z.object({ answer: z.string().trim().min(1).max(2000) });

export const quoteItemSchema = z.object({
  kind: z.enum(QUOTE_ITEM_KINDS),
  description: z.string().trim().min(2).max(200),
  brandModel: z.string().trim().max(120).default(""),
  qty: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20).default("nos"),
  unitPrice: z.number().int().min(0).max(100_000_000),
  gstPercent: z.union(GST_RATES.map((r) => z.literal(r)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>]),
});

export const quoteSaveSchema = z.object({
  items: z.array(quoteItemSchema).max(200),
  timelineDays: z.number().int().min(1).max(730).nullable().default(null),
  warrantyMonths: z.number().int().min(0).max(120).nullable().default(null),
  paymentTerms: z.string().trim().max(1000).default(""),
  validUntil: z.iso.date().nullable().default(null),
  notes: z.string().trim().max(3000).default(""),
  surveyRequired: z.boolean().default(false),
});

/** Submitting needs the fields a company must have to compare quotes. */
export const quoteSubmitSchema = quoteSaveSchema.extend({
  items: z.array(quoteItemSchema).min(1, "Add at least one line item").max(200),
  timelineDays: z.number().int().min(1).max(730),
  warrantyMonths: z.number().int().min(0).max(120),
  paymentTerms: z.string().trim().min(3).max(1000),
});

export const revisionRequestSchema = z.object({ note: z.string().trim().min(5).max(1000) });
export const rfqReasonSchema = z.object({ reason: z.string().trim().max(500).default("") });
export const rfqRejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const vendorSubscriptionSchema = z.object({ subscriptionUntil: z.iso.date().nullable() });

export const rfqConfigSchema = z
  .object({
    maxQuotes: z.number().int().min(1).max(50),
    maxInvites: z.number().int().min(1).max(500),
    minDeadlineDays: z.number().int().min(1).max(30),
    maxDeadlineDays: z.number().int().min(2).max(180),
    earthcliqueBids: z.boolean(),
  })
  .refine((c) => c.minDeadlineDays <= c.maxDeadlineDays, { message: "Minimum deadline must not exceed the maximum", path: ["minDeadlineDays"] })
  .refine((c) => c.maxQuotes <= c.maxInvites, { message: "Quote slots cannot exceed the number of vendors invited", path: ["maxQuotes"] });
export type RfqConfig = z.infer<typeof rfqConfigSchema>;
export const DEFAULT_RFQ_CONFIG: RfqConfig = { maxQuotes: 8, maxInvites: 30, minDeadlineDays: 2, maxDeadlineDays: 60, earthcliqueBids: false };
