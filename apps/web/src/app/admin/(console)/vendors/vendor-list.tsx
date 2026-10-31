"use client";

import type { ProjectCategory } from "@amc/shared";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { projectCategoryLabel } from "@/components/rfq/rfq-badges";
import { statesLabel, SubscriptionLabel } from "@/components/rfq/admin-vendor-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { VendorStatusBadge, type VendorStatus } from "./vendor-status";

type Row = {
  id: string;
  name: string;
  city: string;
  gstin: string;
  status: VendorStatus;
  categories: ProjectCategory[];
  states: string[];
  subscriptionUntil: string | null;
  subscribed: boolean;
  isEarthclique: boolean;
  ratingAvg: number;
  ratingCount: number;
  lastActiveAt: string | null;
  createdAt: string;
};

export function VendorList() {
  const [status, setStatus] = useState<VendorStatus | "all">("pending");
  const [q, setQ] = useState("");
  const query = new URLSearchParams({ ...(status === "all" ? {} : { status }), ...(q.trim() ? { q: q.trim() } : {}) });
  const { data } = useApi<Row[]>(`/admin/vendors${query.size ? `?${query}` : ""}`, "admin", { keepPreviousData: true });

  return (
    <>
      <PageHeader title="Vendors" description="Verify vendor businesses and manage their subscriptions." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as VendorStatus | "all")}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city or GSTIN…" className="max-w-xs" aria-label="Search vendors" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>States</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Link href={`/admin/vendors/${v.id}`} className="hover:underline">
                      <span className="font-medium">
                        {v.name}
                        {v.isEarthclique && <span className="ml-2 text-xs font-normal text-primary">EarthClique</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {v.city} · <span className="font-mono">{v.gstin}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{v.categories.map(projectCategoryLabel).join(", ") || "—"}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm" title={statesLabel(v.states)}>
                    {statesLabel(v.states)}
                  </TableCell>
                  <TableCell>
                    <VendorStatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    <SubscriptionLabel until={v.subscriptionUntil} subscribed={v.subscribed} />
                  </TableCell>
                  <TableCell className="tabular-nums">{v.ratingCount ? `${v.ratingAvg} (${v.ratingCount})` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(v.lastActiveAt)}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No vendors here.
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
