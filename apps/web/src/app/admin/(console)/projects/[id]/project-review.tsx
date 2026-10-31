"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { AdminEventTimeline } from "@/components/rfq/admin-events";
import { AdminQuoteCard } from "@/components/rfq/admin-quote-card";
import { QuestionThread } from "@/components/rfq/question-thread";
import { RequirementBrief } from "@/components/rfq/requirement-brief";
import { CategoryBadge, projectCategoryLabel, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { RequirementDetail } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type Match = { id: string; name: string };

export function ProjectReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: r, mutate } = useApi<RequirementDetail>(`/admin/projects/${id}`, "admin");
  const [busy, setBusy] = useState(false);

  useRealtime("admin", (event) => {
    if ("requirementId" in event && event.requirementId === id) void mutate();
  });

  async function run<T>(fn: () => Promise<T>, success: (result: T) => string) {
    setBusy(true);
    try {
      const result = await fn();
      toast.success(success(result));
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!r) return <Skeleton className="h-96 w-full" />;

  const invites = r.invites ?? [];
  const quotes = r.quotes;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
            <CategoryBadge category={r.category} />
            <RequirementStatusBadge status={r.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{r.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.company?.name ?? "Unknown company"} · {r.city}, {r.state} · Posted {formatDateTime(r.createdAt)}
          </p>
          {r.rejectionReason && r.status === "REJECTED" && <p className="mt-2 text-sm text-destructive">Reason: {r.rejectionReason}</p>}
        </div>

        <RequirementBrief r={r} audience="admin" />

        <QuestionThread questions={r.questions} description="Read-only. The company answers; every invited vendor sees the answers." />

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Quotes</h2>
            <span className="text-sm text-muted-foreground">
              {r.slotsUsed} of {r.maxQuotes} slots used
            </span>
          </div>
          {quotes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">{r.status === "SUBMITTED" ? "Vendors will see this requirement once it's approved." : "No quotes submitted yet."}</CardContent>
            </Card>
          ) : (
            quotes.map((q) => <AdminQuoteCard key={q.id} quote={q} awarded={q.id === r.awardedQuoteId} />)
          )}
        </section>

        <AdminEventTimeline events={r.events} />
      </div>

      <aside className="space-y-4">
        {r.status === "SUBMITTED" && (
          <ReviewCard
            r={r}
            busy={busy}
            onApprove={() => run(() => api<{ invited: number }>(`/admin/projects/${id}/approve`, { method: "POST" }), (res) => `Approved — sent to ${res.invited} vendor${res.invited === 1 ? "" : "s"}`)}
            onReject={(reason) => run(() => api(`/admin/projects/${id}/reject`, { method: "POST", body: { reason } }), () => "Requirement rejected — the company has been told why")}
          />
        )}

        {r.status === "OPEN" && (
          <Card>
            <CardHeader>
              <CardTitle>Ops actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => api<{ invited: number }>(`/admin/projects/${id}/reinvite`, { method: "POST" }), (res) => (res.invited ? `Sent to ${res.invited} more vendor${res.invited === 1 ? "" : "s"}` : "No newly matched vendors to invite"))}
              >
                Re-send to newly matched vendors
              </Button>
              <p className="text-xs text-muted-foreground">Runs matching again, e.g. after verifying new vendors. Vendors already invited are not notified twice.</p>
              <ReasonDialog
                trigger={
                  <Button className="w-full text-destructive" variant="ghost" disabled={busy}>
                    Cancel requirement
                  </Button>
                }
                title="Cancel this requirement?"
                description="Invited vendors are told it's cancelled and can no longer quote."
                confirm="Cancel requirement"
                destructive
                onSubmit={(reason) => run(() => api(`/admin/projects/${id}/cancel`, { method: "POST", body: { reason: reason.trim() } }), () => "Requirement cancelled")}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
            <CardDescription>
              {invites.length} invited · {invites.filter((i) => i.viewedAt).length} viewed · {invites.filter((i) => i.declinedAt).length} declined
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invites.length === 0 && <p className="text-muted-foreground">{r.status === "SUBMITTED" ? "Vendors are invited when you approve." : "No vendors were invited."}</p>}
            {invites.map((i) => (
              <div key={i.vendorId} className="rounded-lg border p-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/admin/vendors/${i.vendorId}`} className="truncate font-medium hover:underline">
                    {i.vendorName ?? "Unknown vendor"}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">#{i.rank}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invited {formatDateTime(i.invitedAt)}
                  {i.viewedAt && ` · viewed ${formatDateTime(i.viewedAt)}`}
                  {i.declinedAt && <span className="text-destructive"> · declined {formatDateTime(i.declinedAt)}</span>}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function ReviewCard({ r, busy, onApprove, onReject }: { r: RequirementDetail; busy: boolean; onApprove: () => Promise<void>; onReject: (reason: string) => Promise<void> }) {
  const { data: matches, error: matchesError } = useApi<Match[]>(`/admin/projects/${r.id}/matches`, "admin");
  const count = matches?.length ?? 0;
  const matchesPending = !matches && !matchesError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
        <CardDescription>Approving sends the requirement to the matching vendors and opens it for quotes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Matching vendors{matches && ` (${count})`}</p>
          {matchesPending ? (
            <Skeleton className="h-10 w-full" />
          ) : matchesError ? (
            <p className="text-xs text-destructive">Couldn&apos;t load the matching vendors: {errorMessage(matchesError)}</p>
          ) : !matches || count === 0 ? (
            <p className="flex gap-2 rounded-md bg-warning/15 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                No verified, subscribed vendor covers {projectCategoryLabel(r.category)} in {r.state} — approve anyway or verify vendors first.
              </span>
            </p>
          ) : (
            <ul className="space-y-1 text-muted-foreground">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/vendors/${m.id}`} className="hover:text-foreground hover:underline">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full" disabled={busy || matchesPending}>
              Approve &amp; send
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send to {count} vendor{count === 1 ? "" : "s"}?</AlertDialogTitle>
              <AlertDialogDescription>
                {count === 0
                  ? "No vendor matches right now. The requirement opens for quotes with nobody invited; you can re-send once vendors are verified."
                  : `${r.code} goes live and the matched vendors are emailed to quote. Quotes close ${formatDateTime(r.quoteDeadline)}.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={() => void onApprove()}>Approve &amp; send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ReasonDialog
          trigger={
            <Button variant="outline" className="w-full" disabled={busy}>
              Reject
            </Button>
          }
          title="Reject this requirement?"
          description="The company sees the reason and can edit and post it again. A reason is required."
          confirm="Reject"
          destructive
          onSubmit={(reason) => {
            const trimmed = reason.trim();
            if (trimmed.length < 3) {
              toast.error("Give the company a reason before rejecting");
              return;
            }
            return onReject(trimmed);
          }}
        />
      </CardContent>
    </Card>
  );
}
