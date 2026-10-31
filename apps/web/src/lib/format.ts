import { CATEGORY_INFO, type Category, type TicketStatus } from "@amc/shared";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatInr = (amount: number | null | undefined) => (amount === null || amount === undefined ? "—" : inr.format(amount));

export const categoryLabel = (c: Category) => CATEGORY_INFO[c].label;

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const timeOnly = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—");

const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : "—");
export const formatTime = (iso: string | null | undefined) => (iso ? timeOnly.format(new Date(iso)) : "—");

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return formatDateTime(iso);
}

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  OPEN: "neutral",
  SEARCHING: "warning",
  UNASSIGNED: "danger",
  ASSIGNED: "info",
  EN_ROUTE: "info",
  ARRIVED: "info",
  IN_PROGRESS: "info",
  ON_HOLD: "warning",
  RESOLVED: "success",
  REMOTE_RESOLVED: "success",
  CLOSED: "neutral",
  CANCELLED: "neutral",
};

/** Straight-line distance in km (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Rough city ETA assuming ~22 km/h average and 1.3× road-vs-straight-line factor. */
export const etaMinutes = (km: number) => Math.max(1, Math.round(((km * 1.3) / 22) * 60));
