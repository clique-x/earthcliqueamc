"use client";

import { REQUIREMENT_STATUS_LABELS, type ServerEvent } from "@amc/shared";
import { CalendarClock, CheckCircle2, Clock, Mail, Paperclip, Phone, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { CompanyQuoteCompare } from "@/components/rfq/company-quote-compare";
import { QuestionThread } from "@/components/rfq/question-thread";
import { RequirementBrief } from "@/components/rfq/requirement-brief";
import { CategoryBadge, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, uploadFile } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { RequirementDetail } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

const ACTOR_LABEL = { company: "You", vendor: "Vendor", admin: "Earthclique ops", system: "System" } as const;
const EDITABLE = ["SUBMITTED", "OPEN"];

export function CompanyProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: r, mutate, error } = useApi<RequirementDetail>(`/company/projects/${id}`, "company");

  useRealtime(
    "company",
    (event: ServerEvent) => {
      if (!("requirementId" in event) || event.requirementId !== id) return;
      void mutate();
      if (event.type === "quote.updated" && event.status === "SUBMITTED") toast.info("New quote received");
    },
    [],
  );

  if (error && !r) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  if (!r) return <Skeleton className="h-96 w-full" />;

  const awarded = r.awardedQuoteId ? r.quotes.find((q) => q.id === r.awardedQuoteId) ?? null : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{r.code}</span>
            <CategoryBadge category={r.category} />
            <RequirementStatusBadge status={r.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{r.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.city}, {r.state} · Raised {formatDateTime(r.createdAt)}
          </p>
        </div>

        <StatusCard r={r} awardedVendor={awarded?.vendor ?? null} />

        <CompanyQuoteCompare requirement={r} refresh={mutate} />

        <RequirementBrief r={r} audience="company" />

        <QuestionThread
          questions={r.questions}
          description="Vendors ask here before quoting. Your answers are shown to every invited vendor."
          onAnswer={async (questionId, answer) => {
            await api(`/company/projects/${r.id}/questions/${questionId}/answer`, { body: { answer } });
            toast.success("Answer posted");
            await mutate();
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l pl-4 text-sm">
              {r.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{e.toStatus ? REQUIREMENT_STATUS_LABELS[e.toStatus] : e.note}</span>
                    <span className="text-xs text-muted-foreground">
                      {ACTOR_LABEL[e.actorType]} · {formatDateTime(e.createdAt)}
                    </span>
                  </div>
                  {e.toStatus && e.note && <p className="text-muted-foreground">{e.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        {EDITABLE.includes(r.status) && <AttachmentCard requirementId={r.id} refresh={mutate} />}

        {EDITABLE.includes(r.status) && (
          <ReasonDialog
            trigger={
              <Button variant="ghost" className="w-full text-destructive">
                Cancel requirement
              </Button>
            }
            title="Cancel this requirement?"
            description={r.status === "OPEN" ? "Every invited vendor will be told the job is cancelled." : "It will not be sent to vendors."}
            confirm="Cancel requirement"
            destructive
            onSubmit={async (reason) => {
              try {
                await api(`/company/projects/${r.id}/cancel`, { body: { reason } });
                toast.success("Requirement cancelled");
                await mutate();
              } catch (err) {
                toast.error(errorMessage(err));
              }
            }}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                ["Ops review", "Earthclique checks the requirement, usually within one working day."],
                ["Vendors quote", "Verified vendors in your state are invited and send itemised quotes before the deadline."],
                ["Compare", "Line items, timelines, warranty and payment terms side by side. Shortlist or ask for revisions."],
                ["Award", "Pick one vendor — their contact details are shared and the others are informed."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
                  <span>
                    <span className="font-medium">{title}</span>
                    <span className="block text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function StatusCard({ r, awardedVendor }: { r: RequirementDetail; awardedVendor: NonNullable<RequirementDetail["quotes"][number]["vendor"]> | null }) {
  switch (r.status) {
    case "SUBMITTED":
      return (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="size-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Under review by Earthclique ops</p>
              <p className="text-sm text-muted-foreground">Vendors will be invited once approved — usually within one working day.</p>
            </div>
          </CardContent>
        </Card>
      );
    case "OPEN":
      return (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="py-4">
            <p className="font-medium">Open for quotes</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" /> Sent to {r.invitedCount ?? 0} vendor{r.invitedCount === 1 ? "" : "s"}
              </span>
              <span>
                {r.slotsUsed} of {r.maxQuotes} quotes received
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-4" /> Closes {formatDateTime(r.quoteDeadline)}
              </span>
            </div>
            {r.deadlinePassed && <p className="mt-2 text-sm font-medium text-warning">The deadline has passed — you can still decide on the quotes received.</p>}
          </CardContent>
        </Card>
      );
    case "REJECTED":
      return (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <XCircle className="size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Not approved by Earthclique ops</p>
              <p className="text-sm text-muted-foreground">{r.rejectionReason || "No reason was given."}</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/app/projects/new">Edit the details and post again</Link>
            </Button>
          </CardContent>
        </Card>
      );
    case "AWARDED":
      return (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="py-4">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-5 text-success" />
              Awarded to {awardedVendor?.name ?? "the selected vendor"}
            </p>
            {awardedVendor?.contact && (
              <div className="mt-3 rounded-lg border bg-background p-3 text-sm">
                <p className="font-medium">{awardedVendor.contact.name}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  <a href={`tel:${awardedVendor.contact.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Phone className="size-3.5" /> {awardedVendor.contact.phone}
                  </a>
                  <a href={`mailto:${awardedVendor.contact.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Mail className="size-3.5" /> {awardedVendor.contact.email}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    case "CANCELLED":
    case "EXPIRED":
      return (
        <Card>
          <CardContent className="py-4">
            <p className="font-medium">{REQUIREMENT_STATUS_LABELS[r.status]}</p>
            <p className="text-sm text-muted-foreground">
              {r.status === "CANCELLED" ? `Closed ${formatDateTime(r.closedAt)}.` : "The deadline passed without any quotes. Post it again with a longer deadline or a wider scope."}
            </p>
          </CardContent>
        </Card>
      );
  }
}

function AttachmentCard({ requirementId, refresh }: { requirementId: string; refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add attachment</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40">
          <Paperclip className="size-4" />
          {busy ? "Uploading…" : "Floor plan, photo or PDF"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                await uploadFile(`/company/projects/${requirementId}/attachments?name=${encodeURIComponent(file.name)}`, file);
                toast.success("Attachment added");
                await refresh();
              } catch (err) {
                toast.error(errorMessage(err));
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}
