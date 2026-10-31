import { PROJECT_CATEGORY_INFO, QUOTE_STATUS_LABELS, REQUIREMENT_STATUS_LABELS, type ProjectCategory, type QuoteStatus, type RequirementStatus } from "@amc/shared";
import type { StatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/15 text-info",
  warning: "bg-warning/20 text-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/15 text-destructive",
};

const REQ_TONE: Record<RequirementStatus, StatusTone> = {
  SUBMITTED: "warning",
  OPEN: "info",
  REJECTED: "danger",
  AWARDED: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

const QUOTE_TONE: Record<QuoteStatus, StatusTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  SHORTLISTED: "warning",
  REVISION_REQUESTED: "warning",
  AWARDED: "success",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
};

function Badge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone], className)}>{children}</span>;
}

export function RequirementStatusBadge({ status, className }: { status: RequirementStatus; className?: string }) {
  return (
    <Badge tone={REQ_TONE[status]} className={className}>
      {REQUIREMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <Badge tone={QUOTE_TONE[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}

export const projectCategoryLabel = (c: ProjectCategory) => PROJECT_CATEGORY_INFO[c].label;

export function CategoryBadge({ category }: { category: ProjectCategory }) {
  return <Badge tone="neutral">{projectCategoryLabel(category)}</Badge>;
}
