"use client";

import { canTransitionQuote, revisionRequestSchema } from "@amc/shared";
import { Mail, Phone, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { QuoteStatusBadge } from "@/components/rfq/rfq-badges";
import { QuoteTable, QuoteTerms } from "@/components/rfq/quote-table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatInr } from "@/lib/format";
import type { QuoteView, RequirementDetail, VendorCard } from "@/lib/rfq-types";
import { cn } from "@/lib/utils";

type Props = { requirement: RequirementDetail; refresh: () => Promise<unknown> };

const vendorName = (q: QuoteView) => q.vendor?.name ?? "Vendor";

/** Side-by-side comparison of every quote on a requirement, with the company's decisions per quote. */
export function CompanyQuoteCompare({ requirement: r, refresh }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(quoteId: string, path: "shortlist" | "request-revision" | "award" | "reject", body: unknown, success: string) {
    setBusy(quoteId);
    try {
      await api(`/company/projects/${r.id}/quotes/${quoteId}/${path}`, { method: "POST", body: body ?? {} });
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (r.quotes.length === 0) {
    if (r.status !== "OPEN") return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quote comparison</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">No quotes yet — vendors have until {formatDateTime(r.quoteDeadline)}.</CardContent>
      </Card>
    );
  }

  const lowest = Math.min(...r.quotes.map((q) => q.total));
  const deciding = r.status === "OPEN";

  const rows: { label: string; cell: (q: QuoteView) => ReactNode; className?: string }[] = [
    { label: "Vendor", cell: (q) => <VendorCell vendor={q.vendor} /> },
    {
      label: "Total (incl. GST)",
      cell: (q) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-semibold tabular-nums">{formatInr(q.total)}</span>
          {q.total === lowest && <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Lowest</span>}
        </span>
      ),
    },
    { label: "Subtotal", cell: (q) => <span className="tabular-nums">{formatInr(q.subtotal)}</span> },
    { label: "GST", cell: (q) => <span className="tabular-nums">{formatInr(q.gstTotal)}</span> },
    { label: "Timeline", cell: (q) => (q.timelineDays ? `${q.timelineDays} days` : "—") },
    { label: "Warranty", cell: (q) => (q.warrantyMonths !== null ? `${q.warrantyMonths} months` : "—") },
    { label: "Payment terms", cell: (q) => <span className="block max-w-56 whitespace-normal text-muted-foreground">{q.paymentTerms || "—"}</span> },
    { label: "Site survey", cell: (q) => (q.surveyRequired ? "Needed before final price" : "Not needed") },
    { label: "Version", cell: (q) => `v${q.version}` },
    {
      label: "Status",
      cell: (q) => (
        <span className="space-y-1">
          <QuoteStatusBadge status={q.status} />
          {q.status === "REVISION_REQUESTED" && q.revisionNote && <span className="block max-w-56 text-xs whitespace-normal text-muted-foreground">Asked: {q.revisionNote}</span>}
        </span>
      ),
    },
  ];
  if (deciding) {
    rows.push({
      label: "Actions",
      className: "align-top",
      cell: (q) => <QuoteActions quote={q} busy={busy === q.id} onDecide={(path, body, success) => decide(q.id, path, body, success)} />,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote comparison</CardTitle>
        <CardDescription>
          {r.quotes.length} quote{r.quotes.length === 1 ? "" : "s"}, lowest total first. Vendor contact details appear once a quote is shortlisted or awarded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card" />
                {r.quotes.map((q, i) => (
                  <TableHead key={q.id} className="min-w-48 text-foreground">
                    Quote {i + 1}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableHead scope="row" className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap text-muted-foreground">
                    {row.label}
                  </TableHead>
                  {r.quotes.map((q) => (
                    <TableCell key={q.id} className={cn("whitespace-nowrap", row.className, q.id === r.awardedQuoteId && "bg-success/5")}>
                      {row.cell(q)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Accordion type="multiple" className="rounded-lg border px-3">
          {r.quotes.map((q, i) => (
            <AccordionItem key={q.id} value={q.id}>
              <AccordionTrigger>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Quote {i + 1} ·</span>
                  {vendorName(q)}
                  <span className="font-normal text-muted-foreground">— view line items</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <QuoteTable quote={q} />
                <QuoteTerms quote={q} />
                {q.vendor?.contact && <ContactCard vendor={q.vendor} />}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function VendorCell({ vendor }: { vendor: VendorCard | null }) {
  if (!vendor) return <span className="text-muted-foreground">Vendor</span>;
  return (
    <span className="block space-y-0.5">
      <span className="flex items-center gap-1.5 font-medium">
        {vendor.name}
        {vendor.isEarthclique && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Earthclique</span>}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {vendor.city}
        <span aria-hidden>·</span>
        <Star className="size-3 fill-warning text-warning" aria-hidden />
        {vendor.ratingCount > 0 ? `${vendor.ratingAvg} (${vendor.ratingCount})` : "New"}
      </span>
    </span>
  );
}

function ContactCard({ vendor }: { vendor: VendorCard }) {
  const c = vendor.contact!;
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="text-xs text-muted-foreground">Vendor contact</p>
      <p className="font-medium">
        {c.name} · {vendor.name}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <Phone className="size-3.5" /> {c.phone}
        </a>
        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <Mail className="size-3.5" /> {c.email}
        </a>
      </p>
    </div>
  );
}

type DecidePath = "shortlist" | "request-revision" | "award" | "reject";

function QuoteActions({ quote: q, busy, onDecide }: { quote: QuoteView; busy: boolean; onDecide: (path: DecidePath, body: unknown, success: string) => Promise<void> }) {
  const name = vendorName(q);
  const can = (to: "SHORTLISTED" | "REVISION_REQUESTED" | "AWARDED" | "REJECTED") => canTransitionQuote(q.status, to, "company");
  if (!can("SHORTLISTED") && !can("REVISION_REQUESTED") && !can("AWARDED") && !can("REJECTED")) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      {can("AWARDED") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={busy}>
              Award
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Award to {name}?</AlertDialogTitle>
              <AlertDialogDescription>Other vendors will be told they weren&apos;t selected and this requirement will close.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDecide("award", {}, `Awarded to ${name}`)}>Award</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {can("SHORTLISTED") && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("shortlist", {}, `${name} shortlisted`)}>
          Shortlist
        </Button>
      )}
      {can("REVISION_REQUESTED") && <RevisionDialog vendor={name} disabled={busy} onSubmit={(note) => onDecide("request-revision", { note }, "Revision requested")} />}
      {can("REJECTED") && (
        <ReasonDialog
          trigger={
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy}>
              Reject
            </Button>
          }
          title={`Reject the quote from ${name}?`}
          description="The vendor will be told their quote wasn't selected."
          confirm="Reject quote"
          destructive
          onSubmit={(reason) => onDecide("reject", { reason }, "Quote rejected")}
        />
      )}
    </div>
  );
}

function RevisionDialog({ vendor, disabled, onSubmit }: { vendor: string; disabled: boolean; onSubmit: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const parsed = revisionRequestSchema.safeParse({ note });
    if (!parsed.success) return setError("Tell the vendor what to change (at least 5 characters)");
    setSending(true);
    try {
      await onSubmit(parsed.data.note);
      setOpen(false);
      setNote("");
      setError(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Request revision
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask {vendor} to revise</DialogTitle>
          <DialogDescription>Say what should change — a different brand, fewer cameras, a shorter timeline. The vendor resubmits a new version.</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="e.g. Please quote 5 MP cameras instead of 4 MP and include a 3-year warranty"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          aria-invalid={error !== null}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Back
          </Button>
          <Button disabled={sending} onClick={submit}>
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
