import { ALL_INDIA } from "@amc/shared";

const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const formatDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : "—");

/** Vendors store ["ALL"] when they serve the whole country. */
export const statesLabel = (states: string[]) => (states.includes(ALL_INDIA) ? "Whole of India" : states.join(", ") || "—");

export const VENDOR_DOC_LABEL: Record<string, string> = {
  gst: "GST certificate",
  pan: "PAN",
  registration: "Company registration",
  certification: "Certification",
  other: "Other",
};

export function SubscriptionLabel({ until, subscribed }: { until: string | null; subscribed: boolean }) {
  if (subscribed) return <span className="text-success">until {formatDate(until)}</span>;
  if (until) return <span className="text-muted-foreground">expired {formatDate(until)}</span>;
  return <span className="text-muted-foreground">Not active</span>;
}
