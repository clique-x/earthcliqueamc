"use client";

import { PROJECT_CATEGORIES, type ProjectCategory } from "@amc/shared";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { CategoryBadge, projectCategoryLabel, RequirementStatusBadge } from "@/components/rfq/rfq-badges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { AdminRequirementRow } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type Scope = "SUBMITTED" | "OPEN" | "AWARDED" | "all";
const ANY_CATEGORY = "all";

export function ProjectList() {
  const [scope, setScope] = useState<Scope>("SUBMITTED");
  const [category, setCategory] = useState<ProjectCategory | typeof ANY_CATEGORY>(ANY_CATEGORY);
  const [q, setQ] = useState("");
  const query = new URLSearchParams({
    ...(scope === "all" ? {} : { status: scope }),
    ...(category === ANY_CATEGORY ? {} : { category }),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const { data, mutate } = useApi<AdminRequirementRow[]>(`/admin/projects${query.size ? `?${query}` : ""}`, "admin", { keepPreviousData: true });

  useRealtime("admin", (event) => {
    if (event.type !== "requirement.updated") return;
    void mutate();
    if (event.status === "SUBMITTED") toast.info("New requirement waiting for review");
  });

  return (
    <>
      <PageHeader title="Project requirements" description="Review new requirements before vendors see them, and follow quotes." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            <TabsTrigger value="SUBMITTED">Pending review</TabsTrigger>
            <TabsTrigger value="OPEN">Open</TabsTrigger>
            <TabsTrigger value="AWARDED">Awarded</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={category} onValueChange={(v) => setCategory(v as ProjectCategory | typeof ANY_CATEGORY)}>
          <SelectTrigger className="w-56" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_CATEGORY}>All categories</SelectItem>
            {PROJECT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {projectCategoryLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code (RQ-10001), title or city…" className="max-w-xs" aria-label="Search requirements" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requirement</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invited</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead>Quotes close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/projects/${r.id}`} className="block max-w-xs hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                      <span className="block truncate font-medium">{r.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell>{r.companyName}</TableCell>
                  <TableCell>
                    <CategoryBadge category={r.category} />
                  </TableCell>
                  <TableCell>
                    {r.city}
                    <span className="block text-xs text-muted-foreground">{r.state}</span>
                  </TableCell>
                  <TableCell>
                    <RequirementStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.invited}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quotes}
                    <span className="text-xs text-muted-foreground"> / {r.maxQuotes}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(r.quoteDeadline)}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    {scope === "SUBMITTED" ? "Nothing waiting for review." : "No requirements match."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
