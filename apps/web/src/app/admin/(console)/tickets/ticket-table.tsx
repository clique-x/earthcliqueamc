"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryLabel, formatDateTime, formatInr } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { TicketListItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Scope = "open" | "closed" | "all";

export function AdminTicketTable() {
  const [scope, setScope] = useState<Scope>("open");
  const [q, setQ] = useState("");
  const query = new URLSearchParams({ scope, ...(q.trim() ? { q: q.trim() } : {}) });
  const { data, mutate } = useApi<TicketListItem[]>(`/admin/tickets?${query}`, "admin", { keepPreviousData: true });

  useRealtime("admin", (event) => {
    if (event.type === "ticket.updated") void mutate();
  });

  return (
    <>
      <PageHeader title="Tickets" description="Search by ticket code (EC-10001), title or company." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="max-w-xs" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/admin/tickets/${t.id}`} className="block max-w-xs hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                      <span className="block truncate font-medium">{t.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {t.companyName}
                    <span className="block text-xs text-muted-foreground">{t.siteLabel}</span>
                  </TableCell>
                  <TableCell>{categoryLabel(t.category)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                  </TableCell>
                  <TableCell>{t.engineerName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInr(t.feeFinal ?? t.feeEstimate)}
                    {t.status === "CLOSED" && <span className="block text-xs text-muted-foreground">{t.paid ? "Paid" : "Unpaid"}</span>}
                  </TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No tickets match.
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
