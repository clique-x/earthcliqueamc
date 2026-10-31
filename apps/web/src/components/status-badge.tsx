import { STATUS_LABELS, type TicketStatus } from "@amc/shared";
import { STATUS_TONE, type StatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/15 text-info",
  warning: "bg-warning/20 text-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[STATUS_TONE[status]], className)}>
      {status === "SEARCHING" && <span className="size-1.5 animate-pulse rounded-full bg-warning" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: "normal" | "urgent" }) {
  if (priority !== "urgent") return null;
  return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Urgent</span>;
}
