"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, QuoteStatusBadge, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { DeadlineText } from "@/components/rfq/vendor-deadline";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatInr } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { VendorRequirementRow } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type Scope = "open" | "quoted" | "closed";

const EMPTY: Record<Scope, { title: string; text: string }> = {
  open: { title: "No open requirements", text: "When a company posts a project in your categories and states, it shows up here and you get an alert." },
  quoted: { title: "No quotes sent yet", text: "Requirements you have quoted on appear here with the status of your quote." },
  closed: { title: "Nothing closed yet", text: "Requirements whose deadline has passed, were awarded, or you declined end up here." },
};

export function RequirementList() {
  const [scope, setScope] = useState<Scope>("open");
  const { data, mutate } = useApi<VendorRequirementRow[]>(`/vendor/requirements?scope=${scope}`, "vendor");

  useRealtime("vendor", (event) => {
    if (event.type === "requirement.invited") {
      void mutate();
      toast.info(`New requirement: ${event.title}`);
    }
    if (event.type === "requirement.updated" || event.type === "quote.updated") void mutate();
  });

  return (
    <>
      <PageHeader title="Requirements" description="Projects companies have sent you to quote on, updated live." />
      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="quoted">Quoted</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">{EMPTY[scope].title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{EMPTY[scope].text}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <Link key={r.id} href={`/vendor/requirements/${r.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-wrap items-start gap-x-4 gap-y-2 py-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <CategoryBadge category={r.category} />
                      <span className="font-mono">{r.code}</span>
                      {r.status !== "OPEN" && <RequirementStatusBadge status={r.status} />}
                    </div>
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {r.city}, {r.state}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <DeadlineText iso={r.quoteDeadline} passed={r.deadlinePassed} />
                      {(r.budgetMin !== null || r.budgetMax !== null) && (
                        <>
                          {" · "}Budget {formatInr(r.budgetMin ?? 0)} – {r.budgetMax === null ? "open" : formatInr(r.budgetMax)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.declined && <span className="text-xs text-muted-foreground">Declined</span>}
                    {r.myQuoteStatus && <QuoteStatusBadge status={r.myQuoteStatus} />}
                    {r.myQuoteTotal !== null && <span className="text-sm font-medium tabular-nums">{formatInr(r.myQuoteTotal)}</span>}
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
