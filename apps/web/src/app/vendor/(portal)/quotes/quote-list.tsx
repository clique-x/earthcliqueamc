"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { QuoteStatusBadge, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatInr, timeAgo } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { VendorRequirementRow } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

export function QuoteList() {
  const { data, mutate } = useApi<VendorRequirementRow[]>("/vendor/requirements?scope=quoted", "vendor");

  useRealtime("vendor", (event) => {
    if (event.type === "quote.updated" || event.type === "requirement.updated") void mutate();
  });

  return (
    <>
      <PageHeader title="My quotes" description="Every quote you have submitted and where it stands." />
      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No quotes submitted yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Open a requirement, build your quote line by line and submit it. It will show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <Link key={r.id} href={`/vendor/requirements/${r.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{r.code}</span>
                      <span>·</span>
                      <span>
                        {r.city}, {r.state}
                      </span>
                      {r.status !== "OPEN" && <RequirementStatusBadge status={r.status} />}
                    </div>
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.closedAt ? `Closed ${timeAgo(r.closedAt)}` : `Quotes close ${formatDateTime(r.quoteDeadline)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.myQuoteStatus && <QuoteStatusBadge status={r.myQuoteStatus} />}
                    <span className="w-24 text-right text-sm font-medium tabular-nums">{formatInr(r.myQuoteTotal)}</span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
