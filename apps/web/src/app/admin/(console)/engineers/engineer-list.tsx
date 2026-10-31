"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryLabel, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { EngineerStatusBadge, type EngineerStatus } from "./engineer-status";
import type { Category } from "@amc/shared";

type Row = {
  id: string;
  name: string;
  phone: string;
  status: EngineerStatus;
  employmentType: "freelance" | "staff";
  skills: Category[];
  isOnline: boolean;
  ratingAvg: number;
  ratingCount: number;
  acceptanceRate: number;
  cooldownUntil: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export function EngineerList() {
  const [status, setStatus] = useState<EngineerStatus | "all">("pending");
  const { data } = useApi<Row[]>(`/admin/engineers${status === "all" ? "" : `?status=${status}`}`, "admin", { keepPreviousData: true });

  return (
    <>
      <PageHeader title="Engineers" description="Review sign-ups, verify KYC and manage who receives job rings." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as EngineerStatus | "all")} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">Pending approval</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engineer</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Acceptance</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/admin/engineers/${e.id}`} className="hover:underline">
                      <span className="font-medium">{e.name || "(profile not filled)"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.phone} · {e.employmentType}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{e.skills.map(categoryLabel).join(", ") || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EngineerStatusBadge status={e.status} />
                      {e.isOnline && <span className="text-xs text-success">● online</span>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{e.ratingCount ? `${e.ratingAvg} (${e.ratingCount})` : "—"}</TableCell>
                  <TableCell className="tabular-nums">{Math.round(e.acceptanceRate * 100)}%</TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(e.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No engineers here.
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
