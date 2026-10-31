"use client";

import { Mail, Phone } from "lucide-react";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatInr } from "@/lib/format";
import type { QuoteView } from "@/lib/rfq-types";
import { QuoteStatusBadge } from "./rfq-badges";
import { QuoteTable, QuoteTerms } from "./quote-table";

/** One vendor's quote as ops sees it: totals up front, line items and terms on demand, vendor contact always shown. */
export function AdminQuoteCard({ quote: q, awarded }: { quote: QuoteView; awarded: boolean }) {
  const v = q.vendor;
  return (
    <Card className={awarded ? "border-success/40" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {v ? (
                <Link href={`/admin/vendors/${v.id}`} className="hover:underline">
                  {v.name}
                </Link>
              ) : (
                "Vendor"
              )}
              {v?.isEarthclique && <span className="text-xs font-normal text-primary">EarthClique</span>}
              <QuoteStatusBadge status={q.status} />
            </CardTitle>
            {v && (
              <p className="mt-1 text-sm text-muted-foreground">
                {v.city}
                {v.ratingCount ? ` · ${v.ratingAvg} ★ (${v.ratingCount})` : " · no ratings yet"}
                {` · v${q.version}`}
                {q.submittedAt && ` · submitted ${formatDateTime(q.submittedAt)}`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">{formatInr(q.total)}</p>
            <p className="text-xs text-muted-foreground">incl. {formatInr(q.gstTotal)} GST</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.revisionNote && (
          <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">
            <span className="font-medium">Revision requested:</span> {q.revisionNote}
          </p>
        )}
        {v?.contact && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium">{v.contact.name}</span>
            <a href={`mailto:${v.contact.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
              <Mail className="size-3.5" /> {v.contact.email}
            </a>
            <a href={`tel:${v.contact.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline">
              <Phone className="size-3.5" /> {v.contact.phone}
            </a>
          </div>
        )}
        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border-b-0">
            <AccordionTrigger>
              {q.items.length} line item{q.items.length === 1 ? "" : "s"} · {q.timelineDays ? `${q.timelineDays} days` : "no timeline"} · {q.warrantyMonths !== null ? `${q.warrantyMonths} mo warranty` : "no warranty"}
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <QuoteTable quote={q} />
              <QuoteTerms quote={q} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
