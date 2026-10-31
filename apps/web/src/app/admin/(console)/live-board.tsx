"use client";

import type { Category, ServerEvent, TicketStatus } from "@amc/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { MapView, type MapMarker } from "@/components/map-view";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel, timeAgo } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import { useApi } from "@/lib/use-api";

type LiveEngineer = { id: string; name: string; skills: Category[]; lat: number; lng: number; lastSeenAt: string | null; activeTicketId: string | null };
type LiveTicket = {
  id: string;
  code: string;
  category: Category;
  priority: "normal" | "urgent";
  title: string;
  status: TicketStatus;
  createdAt: string;
  companyName: string;
  siteLabel: string;
  lat: number;
  lng: number;
  engineerId: string | null;
};
type Live = { engineers: LiveEngineer[]; tickets: LiveTicket[] };
type Stats = {
  ticketsToday: number;
  openTickets: number;
  unassignedTickets: number;
  onlineEngineers: number;
  pendingEngineers: number;
  avgMinutesToAccept: number | null;
  avgMinutesToResolve: number | null;
};

const PRIORITY: Partial<Record<TicketStatus, number>> = { UNASSIGNED: 0, SEARCHING: 1 };

export function LiveBoard() {
  const router = useRouter();
  const { data, mutate } = useApi<Live>("/admin/live", "admin");
  const { data: stats, mutate: mutateStats } = useApi<Stats>("/admin/stats", "admin", { refreshInterval: 60_000 });
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});

  useRealtime("admin", (event: ServerEvent) => {
    if (event.type === "engineer.location") setPositions((p) => ({ ...p, [event.engineerId]: { lat: event.lat, lng: event.lng } }));
    if (event.type === "engineer.presence" || event.type === "ticket.updated") {
      void mutate();
      void mutateStats();
    }
    if (event.type === "admin.unassigned") toast.error(`${event.code}: no engineer accepted — needs manual assignment`, { duration: 15_000 });
  });

  const markers = useMemo<MapMarker[]>(() => {
    if (!data) return [];
    return [
      ...data.tickets.map(
        (t): MapMarker => ({
          id: `t-${t.id}`,
          lat: t.lat,
          lng: t.lng,
          size: "lg",
          tone: t.status === "UNASSIGNED" ? "danger" : t.status === "SEARCHING" ? "warning" : "primary",
          label: `${t.code} · ${t.companyName} · ${t.title}`,
          onClick: () => router.push(`/admin/tickets/${t.id}`),
        }),
      ),
      ...data.engineers.map(
        (e): MapMarker => ({
          id: `e-${e.id}`,
          ...(positions[e.id] ?? { lat: e.lat, lng: e.lng }),
          tone: e.activeTicketId ? "info" : "success",
          label: `${e.name} (${e.skills.join(", ")})${e.activeTicketId ? " — on a job" : " — available"}`,
        }),
      ),
    ];
  }, [data, positions, router]);

  const tickets = [...(data?.tickets ?? [])].sort((a, b) => (PRIORITY[a.status] ?? 2) - (PRIORITY[b.status] ?? 2));

  return (
    <>
      <PageHeader title="Live operations" description="Online engineers and every active ticket, updating in real time." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Tickets today" value={stats?.ticketsToday} />
        <Stat label="Active" value={stats?.openTickets} />
        <Stat label="Unassigned" value={stats?.unassignedTickets} alert={!!stats?.unassignedTickets} href="/admin/tickets" />
        <Stat label="Engineers online" value={stats?.onlineEngineers} />
        <Stat label="Pending approval" value={stats?.pendingEngineers} alert={!!stats?.pendingEngineers} href="/admin/engineers" />
        <Stat label="Avg. time to accept" value={stats?.avgMinutesToAccept === null ? "—" : `${stats?.avgMinutesToAccept ?? "—"} min`} />
        <Stat label="Avg. time to resolve" value={stats?.avgMinutesToResolve === null ? "—" : `${stats?.avgMinutesToResolve ?? "—"} min`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <MapView markers={markers} fitKey={`${data?.tickets.length ?? 0}-${data?.engineers.length ?? 0}`} className="h-[560px]" />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Legend className="bg-success" label="Engineer available" />
            <Legend className="bg-info" label="Engineer on a job" />
            <Legend className="bg-warning" label="Finding engineer" />
            <Legend className="bg-destructive" label="Unassigned" />
            <Legend className="bg-primary" label="Active ticket" />
          </div>
        </div>
        <Card className="max-h-[600px] overflow-hidden">
          <CardHeader>
            <CardTitle>Active tickets ({tickets.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-2 overflow-y-auto">
            {tickets.length === 0 && <p className="text-sm text-muted-foreground">Nothing active right now.</p>}
            {tickets.map((t) => (
              <Link key={t.id} href={`/admin/tickets/${t.id}`} className="block rounded-lg border p-3 text-sm transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-1 truncate font-medium">{t.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t.companyName} · {categoryLabel(t.category)} · {timeAgo(t.createdAt)}
                  </span>
                  <PriorityBadge priority={t.priority} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, alert, href }: { label: string; value: number | string | undefined; alert?: boolean; href?: string }) {
  const body = (
    <Card className={alert ? "border-destructive/50" : undefined}>
      <CardContent className="py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${alert ? "text-destructive" : ""}`}>{value ?? "—"}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
