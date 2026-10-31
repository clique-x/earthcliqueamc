"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryLabel, formatInr, timeAgo } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { TicketListItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Scope = "open" | "closed" | "all";

export function TicketList() {
  const [scope, setScope] = useState<Scope>("open");
  const { data, mutate } = useApi<TicketListItem[]>(`/company/tickets?scope=${scope}`, "company");

  useRealtime("company", (event) => {
    if (event.type === "ticket.updated") void mutate();
  });

  return (
    <>
      <PageHeader
        title="Support tickets"
        description="Every request your team has raised, updated live."
        actions={
          <Button asChild>
            <Link href="/app/tickets/new">
              <Plus /> Raise ticket
            </Link>
          </Button>
        }
      />
      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {!data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">{scope === "open" ? "No open tickets" : "No tickets yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">When something breaks, raise a ticket and we&apos;ll dispatch the nearest engineer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((t) => (
            <Link key={t.id} href={`/app/tickets/${t.id}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{t.code}</span>·<span>{categoryLabel(t.category)}</span>·<span>{t.siteLabel}</span>
                    </div>
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.engineerName ? `${t.engineerName} · ` : ""}
                      {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <span className="w-20 text-right text-sm tabular-nums">{formatInr(t.feeFinal ?? t.feeEstimate)}</span>
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
