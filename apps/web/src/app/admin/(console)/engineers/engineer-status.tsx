import { cn } from "@/lib/utils";

export type EngineerStatus = "pending" | "approved" | "rejected" | "suspended";

const CLASS: Record<EngineerStatus, string> = {
  pending: "bg-warning/20 text-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  suspended: "bg-muted text-muted-foreground",
};

export function EngineerStatusBadge({ status }: { status: EngineerStatus }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", CLASS[status])}>{status}</span>;
}
