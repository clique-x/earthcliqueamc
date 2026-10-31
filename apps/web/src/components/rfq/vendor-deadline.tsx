import { formatDateTime } from "@/lib/format";

/** "in 6 days" / "in 3 h" / "closed" — how long until quotes close. */
export function untilLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} h`;
  return `in ${Math.round(h / 24)} days`;
}

export function DeadlineText({ iso, passed }: { iso: string; passed?: boolean }) {
  return (
    <span>
      Quotes close {formatDateTime(iso)} <span className="text-muted-foreground">({passed ? "closed" : untilLabel(iso)})</span>
    </span>
  );
}
