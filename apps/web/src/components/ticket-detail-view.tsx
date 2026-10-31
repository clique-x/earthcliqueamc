"use client";

import { CATEGORY_INFO, STATUS_LABELS, type ServerEvent } from "@amc/shared";
import { KeyRound, MapPin, Phone, Star } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MapView, type MapMarker } from "@/components/map-view";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, fileUrl, type Audience } from "@/lib/api";
import { categoryLabel, distanceKm, etaMinutes, formatDateTime, formatInr, formatTime, timeAgo } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import type { LatLng, TicketDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const ACTOR_LABEL = { company: "Company", engineer: "Engineer", admin: "Ops", system: "System" } as const;

type Props = {
  ticketId: string;
  audience: Audience;
  /** Extra panels rendered in the side column (actions differ for company vs ops). */
  renderActions?: (ticket: TicketDetail, refresh: () => Promise<unknown>) => ReactNode;
};

export function TicketDetailView({ ticketId, audience, renderActions }: Props) {
  const { data: t, mutate, error } = useApi<TicketDetail>(`/${audience}/tickets/${ticketId}`, audience);
  const [live, setLive] = useState<{ loc: LatLng; at: string; trail: LatLng[] } | null>(null);

  useRealtime(
    audience,
    (event: ServerEvent) => {
      if (event.type === "ticket.updated" && event.ticketId === ticketId) {
        void mutate();
        if (["RESOLVED", "REMOTE_RESOLVED", "UNASSIGNED"].includes(event.status)) toast.info(STATUS_LABELS[event.status]);
      }
      if (event.type === "engineer.location" && event.ticketId === ticketId) {
        const loc = { lat: event.lat, lng: event.lng };
        setLive((prev) => ({ loc, at: event.at, trail: [...(prev?.trail ?? []), loc].slice(-300) }));
      }
    },
    [ticketId],
  );

  const engineerLoc = live?.loc ?? t?.engineerLocation ?? null;
  const route = useMemo(() => [...(t?.route ?? []), ...(live?.trail ?? [])], [t, live]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    if (t?.site) list.push({ id: "site", lat: t.site.lat, lng: t.site.lng, tone: "primary", size: "lg", label: t.site.label });
    if (engineerLoc && t?.engineer) list.push({ id: "engineer", ...engineerLoc, tone: "info", size: "lg", label: t.engineer.name });
    return list;
  }, [t, engineerLoc]);

  if (error && !t) return <p className="text-sm text-destructive">{errorMessage(error)}</p>;
  if (!t) return <Skeleton className="h-96 w-full" />;

  const km = engineerLoc && t.site ? distanceKm(engineerLoc, t.site) : null;
  const showOtp = audience === "company" || audience === "admin";
  const searchingWave = [...t.events].reverse().find((e) => e.note?.startsWith("Wave"))?.note;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{t.code}</span>
            <span>·</span>
            <span>{categoryLabel(t.category)}</span>
            <span>·</span>
            <span>Raised {formatDateTime(t.createdAt)}</span>
            {t.company && audience === "admin" && (
              <>
                <span>·</span>
                <span>{t.company.name}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
          </div>
        </div>

        {t.status === "SEARCHING" && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-warning" />
              </span>
              <div>
                <p className="font-medium">Finding a nearby engineer…</p>
                <p className="text-sm text-muted-foreground">{searchingWave ?? "Starting dispatch"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {t.status === "UNASSIGNED" && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-4">
              <p className="font-medium">No engineer accepted yet</p>
              <p className="text-sm text-muted-foreground">
                {audience === "company" ? "Our ops team has been alerted and will assign someone shortly." : "Assign an engineer manually or re-dispatch."}
              </p>
            </CardContent>
          </Card>
        )}

        <MapView markers={markers} route={route} fitKey={`${t.site?.id}-${t.engineer?.id ?? "none"}`} className="h-[360px]" />

        <Card>
          <CardHeader>
            <CardTitle>Issue details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {t.description && <p className="whitespace-pre-wrap">{t.description}</p>}
            {Object.keys(t.triage).length > 0 && (
              <dl className="grid gap-3 sm:grid-cols-2">
                {CATEGORY_INFO[t.category].triage
                  .filter((q) => t.triage[q.id])
                  .map((q) => (
                    <div key={q.id}>
                      <dt className="text-muted-foreground">{q.label}</dt>
                      <dd className="font-medium">{t.triage[q.id]}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {t.site && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">{t.site.label}</span> — {t.site.address}
                  <br />
                  Contact: {t.site.contactName}, {t.site.contactPhone}
                </span>
              </p>
            )}
            {t.media.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {t.media.map((m) => (
                  <a key={m.id} href={fileUrl(m.url, audience)} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- protected API file, not optimisable by next/image */}
                    <img src={fileUrl(m.url, audience)} alt={`${m.kind} photo`} className="aspect-square w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-xs capitalize">{m.kind}</span>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {t.parts.length > 0 && (
          <PartsCard ticket={t} audience={audience} refresh={mutate} />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l pl-4 text-sm">
              {t.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{e.toStatus ? STATUS_LABELS[e.toStatus] : e.note}</span>
                    <span className="text-xs text-muted-foreground">
                      {ACTOR_LABEL[e.actorType]} · {formatTime(e.createdAt)}
                    </span>
                  </div>
                  {e.toStatus && e.note && <p className="text-muted-foreground">{e.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        {showOtp && t.startOtp && ["ASSIGNED", "EN_ROUTE"].includes(t.status) && (
          <OtpCard label="Start code" hint="Give this to the engineer when they arrive at the site." code={t.startOtp} />
        )}
        {showOtp && t.closeOtp && t.status === "RESOLVED" && (
          <OtpCard label="Closing code" hint="Share it only once you've checked the issue is fixed." code={t.closeOtp} />
        )}

        {t.engineer && (
          <Card>
            <CardHeader>
              <CardTitle>Engineer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold">
                  {t.engineer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- protected API file
                    <img src={fileUrl(t.engineer.photoUrl, audience)} alt="" className="size-full object-cover" />
                  ) : (
                    t.engineer.name.slice(0, 1)
                  )}
                </div>
                <div>
                  <p className="font-medium">{t.engineer.name}</p>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <Star className="size-3.5 fill-warning text-warning" />
                    {t.engineer.ratingCount > 0 ? `${t.engineer.ratingAvg} (${t.engineer.ratingCount})` : "New"}
                  </p>
                </div>
                <Button asChild variant="outline" size="icon" className="ml-auto">
                  <a href={`tel:${t.engineer.phone}`} aria-label="Call engineer">
                    <Phone />
                  </a>
                </Button>
              </div>
              {km !== null && ["ASSIGNED", "EN_ROUTE"].includes(t.status) && (
                <div className="rounded-lg bg-info/10 p-3">
                  <p className="font-medium text-info">
                    {km < 0.15 ? "Arriving now" : `${km.toFixed(1)} km away · about ${etaMinutes(km)} min`}
                  </p>
                  <p className="text-xs text-muted-foreground">Location updated {timeAgo(live?.at ?? t.engineerLocation?.at)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Charges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visit fee (estimate)</span>
              <span>{formatInr(t.feeEstimate)}</span>
            </div>
            {t.feeFinal !== null && (
              <div className="flex justify-between font-medium">
                <span>Final amount</span>
                <span>{formatInr(t.feeFinal)}</span>
              </div>
            )}
            {t.status === "CLOSED" && <p className="pt-1 text-xs text-muted-foreground">{t.paid ? "Paid" : "Payment pending"}</p>}
          </CardContent>
        </Card>

        {renderActions?.(t, mutate)}
      </aside>
    </div>
  );
}

function OtpCard({ label, hint, code }: { label: string; hint: string; code: string }) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="py-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <KeyRound className="size-4" /> {label}
        </p>
        <p className="my-1 font-mono text-4xl font-semibold tracking-[0.3em]">{code}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function PartsCard({ ticket, audience, refresh }: { ticket: TicketDetail; audience: Audience; refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(partId: string, approve: boolean) {
    setBusy(partId);
    try {
      await api(`/company/tickets/${ticket.id}/parts/${partId}/${approve ? "approve" : "reject"}`, { method: "POST" });
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts used</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {ticket.parts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="flex-1">
              <p className="font-medium">
                {p.name} × {p.qty}
              </p>
              <p className="text-muted-foreground">{formatInr(p.qty * p.unitPrice)}</p>
            </div>
            {p.status === "pending" && audience === "company" ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => decide(p.id, false)}>
                  Reject
                </Button>
                <Button size="sm" disabled={busy === p.id} onClick={() => decide(p.id, true)}>
                  Approve
                </Button>
              </div>
            ) : (
              <span className={p.status === "rejected" ? "text-destructive" : p.status === "pending" ? "text-warning" : "text-success"}>
                {p.status === "pending" ? "Awaiting company approval" : p.status === "rejected" ? "Rejected" : "Approved"}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
