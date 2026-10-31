"use client";

import type { Category, TicketStatus } from "@amc/shared";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";
import { MapView } from "@/components/map-view";
import { ReasonDialog } from "@/components/reason-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, fileUrl } from "@/lib/api";
import { categoryLabel, formatDateTime, timeAgo } from "@/lib/format";
import type { LatLng } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { EngineerStatusBadge, type EngineerStatus } from "../engineer-status";

type Engineer = {
  id: string;
  name: string;
  phone: string;
  status: EngineerStatus;
  rejectionReason: string | null;
  employmentType: "freelance" | "staff";
  skills: Category[];
  serviceRadiusKm: number;
  isOnline: boolean;
  lastLocation: LatLng | null;
  lastSeenAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  acceptanceRate: number;
  cooldownUntil: string | null;
  createdAt: string;
  kyc: { id: string; docType: string; url: string; verified: boolean; createdAt: string }[];
  jobs: { id: string; code: string; title: string; status: TicketStatus; createdAt: string }[];
};

const DOC_LABEL: Record<string, string> = { aadhaar: "Aadhaar", pan: "PAN", selfie: "Selfie", other: "Other" };

export function EngineerReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: e, mutate } = useApi<Engineer>(`/admin/engineers/${id}`, "admin");
  const [busy, setBusy] = useState(false);

  async function run(action: "approve" | "reject" | "suspend", body?: unknown) {
    setBusy(true);
    try {
      await api(`/admin/engineers/${id}/${action}`, { method: "POST", body });
      toast.success(action === "approve" ? "Engineer approved — they can now go online" : `Engineer ${action === "reject" ? "rejected" : "suspended"}`);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!e) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{e.name || "(profile not filled)"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <EngineerStatusBadge status={e.status} />
            <span>{e.phone}</span>·<span className="capitalize">{e.employmentType}</span>·<span>Joined {formatDateTime(e.createdAt)}</span>
          </div>
          {e.rejectionReason && <p className="mt-2 text-sm text-destructive">Reason: {e.rejectionReason}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>KYC documents</CardTitle>
          </CardHeader>
          <CardContent>
            {e.kyc.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {e.kyc.map((d) => (
                  <a key={d.id} href={fileUrl(d.url, "admin")} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- protected API file */}
                    <img src={fileUrl(d.url, "admin")} alt={DOC_LABEL[d.docType]} className="aspect-[4/3] w-full object-cover" />
                    <div className="flex justify-between px-2 py-1 text-xs">
                      <span>{DOC_LABEL[d.docType]}</span>
                      <span className={d.verified ? "text-success" : "text-muted-foreground"}>{d.verified ? "Verified" : "Unverified"}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {e.lastLocation && (
          <MapView markers={[{ id: e.id, ...e.lastLocation, tone: e.isOnline ? "success" : "muted", size: "lg", label: e.name }]} className="h-64" />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {e.jobs.length === 0 && <p className="text-muted-foreground">No jobs yet.</p>}
            {e.jobs.map((j) => (
              <Link key={j.id} href={`/admin/tickets/${j.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-2 hover:border-primary/40">
                <span className="truncate">
                  <span className="font-mono text-xs text-muted-foreground">{j.code}</span> {j.title}
                </span>
                <StatusBadge status={j.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Skills" value={e.skills.map(categoryLabel).join(", ") || "—"} />
            <Row label="Service radius" value={`${e.serviceRadiusKm} km`} />
            <Row label="Rating" value={e.ratingCount ? `${e.ratingAvg} from ${e.ratingCount}` : "No ratings yet"} />
            <Row label="Acceptance rate" value={`${Math.round(e.acceptanceRate * 100)}%`} />
            <Row label="Online" value={e.isOnline ? "Yes" : `No · last seen ${timeAgo(e.lastSeenAt)}`} />
            {e.cooldownUntil && new Date(e.cooldownUntil) > new Date() && <Row label="Dispatch cooldown until" value={formatDateTime(e.cooldownUntil)} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {e.status !== "approved" && (
              <Button className="w-full" disabled={busy || !e.name || e.skills.length === 0} onClick={() => run("approve")}>
                Approve
              </Button>
            )}
            {(!e.name || e.skills.length === 0) && <p className="text-xs text-muted-foreground">The engineer must complete their profile before approval.</p>}
            {e.status === "pending" && (
              <ReasonDialog
                trigger={
                  <Button variant="outline" className="w-full" disabled={busy}>
                    Reject
                  </Button>
                }
                title="Reject this engineer?"
                description="They'll see the reason in the app."
                confirm="Reject"
                destructive
                onSubmit={(reason) => run("reject", { reason: reason || "Documents could not be verified" })}
              />
            )}
            {e.status === "approved" && (
              <ReasonDialog
                trigger={
                  <Button variant="ghost" className="w-full text-destructive" disabled={busy}>
                    Suspend
                  </Button>
                }
                title="Suspend this engineer?"
                description="They'll be taken offline and stop receiving rings."
                confirm="Suspend"
                destructive
                onSubmit={(reason) => run("suspend", { reason: reason || "Suspended by ops" })}
              />
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
