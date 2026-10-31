"use client";

import { canTransitionQuote } from "@amc/shared";
import { Building2, CheckCircle2, Info, MapPin, Star } from "lucide-react";
import { use } from "react";
import { toast } from "sonner";
import { QuestionThread } from "@/components/rfq/question-thread";
import { QuoteTable, QuoteTerms } from "@/components/rfq/quote-table";
import { RequirementBrief } from "@/components/rfq/requirement-brief";
import { CategoryBadge, QuoteStatusBadge, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { ConfirmDialog } from "@/components/rfq/vendor-confirm";
import { DeadlineText } from "@/components/rfq/vendor-deadline";
import { VendorQuoteBuilder } from "@/components/rfq/vendor-quote-builder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { QuoteView, RequirementDetail } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

const EDITABLE: ReadonlyArray<QuoteView["status"] | null> = [null, "DRAFT", "REVISION_REQUESTED"];

export function VendorRequirement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: r, mutate, error } = useApi<RequirementDetail>(`/vendor/requirements/${id}`, "vendor");

  useRealtime("vendor", (event) => {
    if ("requirementId" in event && event.requirementId === id) void mutate();
  });

  if (error && !r) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  if (!r) return <Skeleton className="h-96 w-full" />;

  const quote = r.myQuote;
  const open = r.status === "OPEN" && !r.deadlinePassed;
  const editable = EDITABLE.includes(quote?.status ?? null);
  const declined = !!r.myInvite?.declinedAt;

  async function ask(question: string) {
    await api(`/vendor/requirements/${id}/questions`, { body: { question } });
    await mutate();
  }

  async function decline() {
    try {
      await api(`/vendor/requirements/${id}/decline`, { method: "POST" });
      await mutate();
      toast.success("Marked as not interested");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function withdraw() {
    try {
      await api(`/vendor/requirements/${id}/quote/withdraw`, { method: "POST" });
      await mutate();
      toast.success("Quote withdrawn");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{r.code}</span>
          <span>·</span>
          <CategoryBadge category={r.category} />
          <RequirementStatusBadge status={r.status} />
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {r.company && (
            <span className="flex items-center gap-1">
              <Building2 className="size-4" /> {r.company.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MapPin className="size-4" /> {r.city}, {r.state}
          </span>
          <span>
            {r.slotsLeft} of {r.maxQuotes} quote slots left
          </span>
          <DeadlineText iso={r.quoteDeadline} passed={r.deadlinePassed} />
        </div>
        {!open && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {r.status === "OPEN" ? "The quote deadline has passed — quotes and questions are closed." : "This requirement is no longer open for quotes or questions."}
          </p>
        )}
      </div>

      {quote?.status === "AWARDED" && (
        <Alert className="border-success/40 bg-success/10">
          <CheckCircle2 className="text-success" />
          <AlertTitle>You won this project — contact details are below</AlertTitle>
          <AlertDescription>The site address and contact are in the requirement card. Reach out to the company to schedule the work.</AlertDescription>
        </Alert>
      )}
      {quote?.status === "SHORTLISTED" && (
        <Alert className="border-info/40 bg-info/10">
          <Star className="text-info" />
          <AlertTitle>Shortlisted — the company&apos;s site address and contact are now visible</AlertTitle>
          <AlertDescription>The company may still ask for a revision before deciding.</AlertDescription>
        </Alert>
      )}
      {declined && !quote && (
        <Alert>
          <Info />
          <AlertTitle>You marked this requirement as not interested</AlertTitle>
          <AlertDescription>It is listed under Closed. You can still read the brief and the questions.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-6">
          <RequirementBrief r={r} audience="vendor" />
          <QuestionThread questions={r.questions} onAsk={open ? ask : undefined} description={open ? undefined : "Questions are closed for this requirement. Earlier answers stay visible."} />
        </div>

        <div className="space-y-6">
          {editable && open ? (
            <>
              <VendorQuoteBuilder key={quote ? `${quote.id}:${quote.updatedAt}` : "new"} requirementId={id} quote={quote} onChanged={mutate} />
              {!quote && !declined && (
                <div className="flex justify-end">
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" className="text-muted-foreground">
                        Not interested
                      </Button>
                    }
                    title="Not interested in this requirement?"
                    description="It moves to your Closed list and the company sees that you declined. You can still come back and quote while it is open."
                    confirm="Mark not interested"
                    onConfirm={decline}
                  />
                </div>
              )}
            </>
          ) : quote ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    Your quote <span className="text-sm font-normal text-muted-foreground">v{quote.version}</span>
                  </CardTitle>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                <CardDescription>
                  {quote.submittedAt ? `Submitted ${formatDateTime(quote.submittedAt)}` : `Last saved ${formatDateTime(quote.updatedAt)}`}
                  {quote.decidedAt && quote.status !== "SUBMITTED" ? ` · ${quote.status === "WITHDRAWN" ? "Withdrawn" : "Decided"} ${formatDateTime(quote.decidedAt)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {quote.status === "DRAFT" && <p className="text-sm text-muted-foreground">This draft was never submitted and quoting has now closed.</p>}
                <QuoteTable quote={quote} />
                <div className="border-t pt-4">
                  <QuoteTerms quote={quote} />
                </div>
                {open && canTransitionQuote(quote.status, "WITHDRAWN", "vendor") && (
                  <div className="flex justify-end border-t pt-4">
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" className="text-destructive">
                          Withdraw quote
                        </Button>
                      }
                      title="Withdraw this quote?"
                      description="The company will be notified and your quote slot is released. You cannot submit again for this requirement."
                      confirm="Withdraw quote"
                      destructive
                      onConfirm={withdraw}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="font-medium">{declined ? "You declined this requirement" : "Quoting is closed"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{declined ? "No quote was sent." : "The deadline passed or the company closed the requirement before you quoted."}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
