"use client";

import { CalendarClock, MapPin, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatInr } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { CompanyRequirementRow } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type Scope = "open" | "closed" | "all";

function budgetLabel(r: CompanyRequirementRow) {
  if (r.budgetMin === null && r.budgetMax === null) return null;
  return `${formatInr(r.budgetMin ?? 0)} – ${r.budgetMax === null ? "open" : formatInr(r.budgetMax)}`;
}

export function ProjectList() {
  const [scope, setScope] = useState<Scope>("open");
  const { data, mutate } = useApi<CompanyRequirementRow[]>(`/company/projects?scope=${scope}`, "company");

  useRealtime("company", (event) => {
    if (event.type === "requirement.updated" || event.type === "quote.updated") void mutate();
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Large jobs quoted by verified vendors across India"
        actions={
          <Button asChild>
            <Link href="/app/projects/new">
              <Plus /> Post a requirement
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
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">{scope === "open" ? "No open projects" : "No projects yet"}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Projects are for large, planned jobs — a new CCTV system, office network, server room. Post what you need and verified vendors in your state send
              itemised quotes you can compare side by side.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/app/projects/new">Post a requirement</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((r) => {
            const budget = budgetLabel(r);
            const showInvited = r.status === "OPEN" || r.status === "AWARDED";
            return (
              <Link key={r.id} href={`/app/projects/${r.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{r.code}</span>
                        <CategoryBadge category={r.category} />
                        <RequirementStatusBadge status={r.status} />
                      </div>
                      <p className="truncate font-medium">{r.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {r.city}, {r.state}
                        </span>
                        {showInvited && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" />
                            Sent to {r.invitedCount} vendor{r.invitedCount === 1 ? "" : "s"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" />
                          Quotes close {formatDateTime(r.quoteDeadline)}
                        </span>
                      </div>
                    </div>
                    {budget && <span className="text-sm tabular-nums text-muted-foreground">{budget}</span>}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
