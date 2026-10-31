import { z } from "zod";
import { CATEGORIES } from "./categories";

const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number");
const latLng = { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) };

export const engineerOtpRequestSchema = z.object({ phone });
export const engineerOtpVerifySchema = z.object({ phone, code: z.string().regex(/^\d{6}$/) });

export const passwordLoginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export const companySignupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  gstin: z.string().trim().max(15).optional(),
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone,
  password: z.string().min(8).max(100),
});

export const companyUserCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone,
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "user"]),
});

export const siteCreateSchema = z.object({
  label: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(300),
  ...latLng,
  contactName: z.string().trim().min(2).max(80),
  contactPhone: phone,
});

export const ticketCreateSchema = z.object({
  siteId: z.uuid(),
  category: z.enum(CATEGORIES),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(2000).default(""),
  triage: z.record(z.string(), z.string().max(500)).default({}),
});

export const engineerProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  skills: z.array(z.enum(CATEGORIES)).min(1),
  serviceRadiusKm: z.number().int().min(2).max(50),
  employmentType: z.enum(["freelance", "staff"]),
});

export const engineerOnlineSchema = z
  .object({ online: z.boolean(), lat: latLng.lat.optional(), lng: latLng.lng.optional() })
  .refine((v) => !v.online || (v.lat !== undefined && v.lng !== undefined), "Your location is needed to go online");
export const engineerLocationSchema = z.object(latLng);
export const fcmTokenSchema = z.object({ token: z.string().min(10).max(4096) });

export const otpEntrySchema = z.object({ otp: z.string().regex(/^\d{4}$/) });
export const noteSchema = z.object({ note: z.string().trim().max(1000).default("") });
export const reasonSchema = z.object({ reason: z.string().trim().max(500).default("") });

export const partCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  qty: z.number().int().min(1).max(100),
  unitPrice: z.number().int().min(0).max(1_000_000),
});

export const ratingSchema = z.object({ score: z.number().int().min(1).max(5), comment: z.string().trim().max(500).default("") });

export const adminAssignSchema = z.object({ engineerId: z.uuid() });
export const adminRejectSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export const dispatchConfigSchema = z.object({
  waves: z
    .array(z.object({ radiusKm: z.number().min(1).max(100), maxEngineers: z.number().int().min(1).max(200), timeoutSec: z.number().int().min(10).max(300) }))
    .min(1)
    .max(6),
  staleLocationMin: z.number().int().min(1).max(60),
  fees: z.object({ pc: z.number().int(), network: z.number().int(), cctv: z.number().int(), remote: z.number().int() }),
  partsApprovalThreshold: z.number().int().min(0),
  autoCloseHours: z.number().int().min(1).max(168),
  cancelCooldown: z.object({ maxCancels: z.number().int().min(1), windowDays: z.number().int().min(1), cooldownHours: z.number().int().min(1) }),
});

export type DispatchConfig = z.infer<typeof dispatchConfigSchema>;

export const DEFAULT_DISPATCH_CONFIG: DispatchConfig = {
  waves: [
    { radiusKm: 5, maxEngineers: 5, timeoutSec: 30 },
    { radiusKm: 10, maxEngineers: 10, timeoutSec: 30 },
    { radiusKm: 20, maxEngineers: 200, timeoutSec: 45 },
  ],
  staleLocationMin: 5,
  // Placeholder INR visit fees — set real pricing in the admin panel.
  fees: { pc: 499, network: 699, cctv: 799, remote: 299 },
  partsApprovalThreshold: 1000,
  autoCloseHours: 24,
  cancelCooldown: { maxCancels: 3, windowDays: 7, cooldownHours: 24 },
};
