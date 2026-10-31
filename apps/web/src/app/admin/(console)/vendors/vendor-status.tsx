import { cn } from "@/lib/utils";

export type VendorStatus = "pending" | "approved" | "rejected" | "suspended";

const CLASS: Record<VendorStatus, string> = {
  pending: "bg-warning/20 text-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  suspended: "bg-muted text-muted-foreground",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", CLASS[status])}>{status}</span>;
}
