"use client";

import type { ProjectCategory, QuoteStatus } from "@amc/shared";
import { ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { use, useId, useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { formatDate, statesLabel, SubscriptionLabel, VENDOR_DOC_LABEL } from "@/components/rfq/admin-vendor-meta";
import { projectCategoryLabel, QuoteStatusBadge } from "@/components/rfq/rfq-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage, fileUrl } from "@/lib/api";
import { formatDateTime, formatInr, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { VendorStatusBadge, type VendorStatus } from "../vendor-status";

type Vendor = {
  id: string;
  name: string;
  city: string;
  gstin: string;
  status: VendorStatus;
  rejectionReason: string | null;
  categories: ProjectCategory[];
  states: string[];
  description: string;
  website: string;
  certifications: string[];
  teamSize: number | null;
  foundedYear: number | null;
  isEarthclique: boolean;
  subscriptionUntil: string | null;
  subscribed: boolean;
  ratingAvg: number;
  ratingCount: number;
  lastActiveAt: string | null;
  createdAt: string;
  users: { id: string; name: string; email: string; phone: string; role: "admin" | "member" }[];
  documents: { id: string; docType: string; label: string | null; url: string; verified: boolean; createdAt: string }[];
  stats: { invited: number; quoted: number; won: number };
  quotes: { id: string; requirementId: string; code: string | null; title: string | null; status: QuoteStatus; total: number; updatedAt: string }[];
};

const isPdf = (url: string) => /\.pdf$/i.test(url);

/** Today as YYYY-MM-DD in the browser's local time, for the date input's `min`. */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function VendorReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: v, mutate } = useApi<Vendor>(`/admin/vendors/${id}`, "admin");
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const decide = (action: "approve" | "reject" | "suspend", body?: unknown) =>
    run(
      action === "approve" ? "Vendor verified — they'll receive matching requirements once subscribed" : `Vendor ${action === "reject" ? "rejected" : "suspended"}`,
      () => api(`/admin/vendors/${id}/${action}`, { method: "POST", body }),
    );

  if (!v) return <Skeleton className="h-96 w-full" />;

  const canApprove = v.status !== "approved";
  const hasDocs = v.documents.length > 0;
  const website = v.website ? (/^https?:\/\//i.test(v.website) ? v.website : `https://${v.website}`) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{v.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <VendorStatusBadge status={v.status} />
            <span>{v.city}</span>·<span className="font-mono text-xs">{v.gstin}</span>
            {website && (
              <>
                ·
                <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                  {v.website.replace(/^https?:\/\//i, "")} <ExternalLink className="size-3" />
                </a>
              </>
            )}
            ·<span>Joined {formatDate(v.createdAt)}</span>
          </div>
          {v.rejectionReason && v.status !== "approved" && <p className="mt-2 text-sm text-destructive">Reason: {v.rejectionReason}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {v.description && <p className="whitespace-pre-wrap">{v.description}</p>}
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item label="Categories" value={v.categories.map(projectCategoryLabel).join(", ") || "—"} />
              <Item label="States served" value={statesLabel(v.states)} />
              <Item label="Certifications" value={v.certifications.join(", ") || "—"} />
              <Item label="Team size" value={v.teamSize === null ? "—" : String(v.teamSize)} />
              <Item label="Founded" value={v.foundedYear === null ? "—" : String(v.foundedYear)} />
              <Item label="Rating" value={v.ratingCount ? `${v.ratingAvg} from ${v.ratingCount} review${v.ratingCount === 1 ? "" : "s"}` : "No ratings yet"} />
              <Item label="Last active" value={timeAgo(v.lastActiveAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification documents</CardTitle>
            <CardDescription>GST, PAN and registration proofs uploaded by the vendor. Approving marks them all as verified.</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasDocs ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {v.documents.map((d) => {
                  const href = fileUrl(d.url, "admin");
                  const title = `${VENDOR_DOC_LABEL[d.docType] ?? d.docType}${d.label ? ` · ${d.label}` : ""}`;
                  return (
                    <a key={d.id} href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border hover:border-primary/40">
                      {isPdf(d.url) ? (
                        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
                          <FileText className="size-8" />
                          <span className="text-xs">PDF · opens in new tab</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- protected API file
                        <img src={href} alt={title} className="aspect-[4/3] w-full object-cover" />
                      )}
                      <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                        <span className="truncate" title={title}>
                          {title}
                        </span>
                        <span className={d.verified ? "shrink-0 text-success" : "shrink-0 text-muted-foreground"}>{d.verified ? "Verified" : "Unverified"}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <a href={`mailto:${u.email}`} className="hover:underline">
                        {u.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <a href={`tel:${u.phone}`} className="hover:underline">
                        {u.phone}
                      </a>
                    </TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                  </TableRow>
                ))}
                {v.users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No users.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Invited" value={v.stats.invited} />
              <Stat label="Quoted" value={v.stats.quoted} />
              <Stat label="Won" value={v.stats.won} />
            </dl>
            {v.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotes yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link href={`/admin/projects/${q.requirementId}`} className="block max-w-xs hover:underline">
                          <span className="font-mono text-xs text-muted-foreground">{q.code ?? "—"}</span>
                          <span className="block truncate font-medium">{q.title ?? "(requirement removed)"}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={q.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(q.total)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(q.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {canApprove && (
              <Button className="w-full" disabled={busy || !hasDocs} onClick={() => decide("approve")}>
                Approve
              </Button>
            )}
            {canApprove && !hasDocs && <p className="text-xs text-muted-foreground">The vendor must upload at least one verification document before approval.</p>}
            {v.status === "pending" && (
              <ReasonDialog
                trigger={
                  <Button variant="outline" className="w-full" disabled={busy}>
                    Reject
                  </Button>
                }
                title="Reject this vendor?"
                description="They'll receive the reason by email."
                confirm="Reject"
                destructive
                onSubmit={(reason) => decide("reject", { reason: reason.trim() || "Documents could not be verified" })}
              />
            )}
            {v.status === "approved" && (
              <ReasonDialog
                trigger={
                  <Button variant="ghost" className="w-full text-destructive" disabled={busy}>
                    Suspend
                  </Button>
                }
                title="Suspend this vendor?"
                description="They'll stop receiving requirements and can't quote until re-approved."
                confirm="Suspend"
                destructive
                onSubmit={(reason) => decide("suspend", { reason: reason.trim() || "Suspended by ops" })}
              />
            )}
          </CardContent>
        </Card>

        <SubscriptionCard vendor={v} busy={busy} onSet={(until) => run(until ? "Subscription updated" : "Subscription removed", () => api(`/admin/vendors/${id}/subscription`, { method: "PUT", body: { subscriptionUntil: until } }))} />

        <Card>
          <CardHeader>
            <CardTitle>Earthclique&apos;s own vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <EarthcliqueSwitch checked={v.isEarthclique} disabled={busy} onChange={(isEarthclique) => run(isEarthclique ? "Marked as Earthclique's own vendor" : "Unmarked as Earthclique's own vendor", () => api(`/admin/vendors/${id}/earthclique`, { method: "PUT", body: { isEarthclique } }))} />
            <p className="text-xs text-muted-foreground">
              Marks this account as Earthclique&apos;s in-house team. It only receives requirements when &ldquo;Allow Earthclique&apos;s own vendor account to bid&rdquo; is on in Project quotation settings.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function SubscriptionCard({ vendor: v, busy, onSet }: { vendor: Vendor; busy: boolean; onSet: (until: string | null) => Promise<void> }) {
  const [date, setDate] = useState("");
  const inputId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>
          Current: <SubscriptionLabel until={v.subscriptionUntil} subscribed={v.subscribed} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>Active until</Label>
          <div className="flex gap-2">
            <Input id={inputId} type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
            <Button
              disabled={busy || !date}
              onClick={async () => {
                await onSet(date);
                setDate("");
              }}
            >
              Set
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Only verified vendors with an active subscription are matched to requirements. Set by hand until payments go live.</p>
        </div>
        {v.subscriptionUntil && (
          <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => onSet(null)}>
            Remove subscription
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EarthcliqueSwitch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  const switchId = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={switchId}>In-house vendor</Label>
      <Switch id={switchId} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
