"use client";

import { ALL_INDIA, INDIAN_STATES, PROJECT_CATEGORIES, PROJECT_CATEGORY_INFO, vendorProfileSchema, type ProjectCategory } from "@amc/shared";
import { CheckCircle2, ExternalLink, Star, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, fileUrl, uploadFile } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { VendorMe, VendorProfile } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type DocType = "gst" | "pan" | "registration" | "certification" | "other";
type VendorDocument = { id: string; docType: DocType; label: string; url: string; verified: boolean; createdAt: string };

const DOC_LABEL: Record<DocType, string> = {
  gst: "GST certificate",
  pan: "PAN card",
  registration: "Company registration / Udyam",
  certification: "OEM certification",
  other: "Other",
};

const VENDOR_STATUS_LABEL: Record<VendorProfile["status"], string> = { pending: "Verification pending", approved: "Verified", rejected: "Not approved", suspended: "Suspended" };

export function ProfileManager() {
  const { data: me, mutate } = useApi<VendorMe>("/vendor/me", "vendor");
  const isAdmin = me?.user.role === "admin";

  return (
    <>
      <PageHeader title="Profile & verification" description="What companies see about you, and the documents EarthClique needs to verify your business." />
      {!me ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <ProfileForm key={me.vendor.id} vendor={me.vendor} readOnly={!isAdmin} onSaved={mutate} />
          <div className="space-y-6">
            <SubscriptionCard vendor={me.vendor} />
            <DocumentsCard canUpload={isAdmin} />
          </div>
        </div>
      )}
    </>
  );
}

function ProfileForm({ vendor, readOnly, onSaved }: { vendor: VendorProfile; readOnly: boolean; onSaved: () => Promise<unknown> }) {
  const [categories, setCategories] = useState<ProjectCategory[]>(vendor.categories);
  const [allIndia, setAllIndia] = useState(vendor.states.includes(ALL_INDIA));
  const [states, setStates] = useState<string[]>(vendor.states.filter((s) => s !== ALL_INDIA));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const teamSize = String(f.get("teamSize") ?? "").trim();
    const foundedYear = String(f.get("foundedYear") ?? "").trim();
    const parsed = vendorProfileSchema.safeParse({
      name: f.get("name"),
      city: f.get("city"),
      categories,
      states: allIndia ? [ALL_INDIA] : states,
      description: f.get("description"),
      website: f.get("website"),
      certifications: String(f.get("certifications") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      teamSize: teamSize === "" ? null : Number(teamSize),
      foundedYear: foundedYear === "" ? null : Number(foundedYear),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.path[0] === "states" ? "Pick at least one state or turn on Whole of India" : issue?.path[0] === "categories" ? "Pick at least one category" : `${String(issue?.path[0] ?? "")}: ${issue?.message ?? "Check the form"}`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api("/vendor/me", { method: "PATCH", body: parsed.data });
      await onSaved();
      toast.success("Profile saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company profile</CardTitle>
        <CardDescription>{readOnly ? "Only vendor admins can edit the profile." : "Shown to companies alongside your quotes. GSTIN cannot be changed here."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset disabled={readOnly} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor name" htmlFor="name">
                <Input id="name" name="name" defaultValue={vendor.name} required minLength={2} maxLength={120} />
              </Field>
              <Field label="GSTIN">
                <Input value={vendor.gstin} readOnly className="font-mono" />
              </Field>
              <Field label="City" htmlFor="city">
                <Input id="city" name="city" defaultValue={vendor.city} required minLength={2} maxLength={80} />
              </Field>
              <Field label="Website" htmlFor="website">
                <Input id="website" name="website" defaultValue={vendor.website} placeholder="https://" maxLength={200} inputMode="url" />
              </Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Categories</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_CATEGORIES.map((c) => {
                  const id = `pcat-${c}`;
                  return (
                    <Label key={c} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary/60 has-data-checked:bg-primary/5">
                      <Checkbox id={id} checked={categories.includes(c)} onCheckedChange={(v) => setCategories((prev) => (v === true ? [...prev, c] : prev.filter((x) => x !== c)))} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{PROJECT_CATEGORY_INFO[c].label}</span>
                        <span className="block text-xs text-muted-foreground">{PROJECT_CATEGORY_INFO[c].description}</span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">States you serve</legend>
              <Label htmlFor="allIndia" className="flex w-fit items-center gap-2 font-normal">
                <Switch id="allIndia" checked={allIndia} onCheckedChange={setAllIndia} />
                Whole of India
              </Label>
              <div aria-disabled={allIndia} className={allIndia ? "pointer-events-none opacity-50" : undefined}>
                <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2 md:grid-cols-3">
                  {INDIAN_STATES.map((s) => {
                    const id = `state-${s.replace(/\s+/g, "-")}`;
                    return (
                      <Label key={s} htmlFor={id} className="flex items-center gap-2 py-0.5 text-sm font-normal">
                        <Checkbox id={id} disabled={allIndia} checked={states.includes(s)} onCheckedChange={(v) => setStates((prev) => (v === true ? [...prev, s] : prev.filter((x) => x !== s)))} />
                        {s}
                      </Label>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <Field label="About your company" htmlFor="description">
              <Textarea id="description" name="description" defaultValue={vendor.description} rows={3} maxLength={2000} placeholder="Years in business, typical projects, OEM partnerships…" />
            </Field>
            <Field label="Certifications" htmlFor="certifications" hint="Comma-separated, e.g. Hikvision Certified Partner, Cisco Select Partner">
              <Input id="certifications" name="certifications" defaultValue={vendor.certifications.join(", ")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Team size" htmlFor="teamSize">
                <Input id="teamSize" name="teamSize" type="number" inputMode="numeric" min={1} max={100000} defaultValue={vendor.teamSize ?? ""} />
              </Field>
              <Field label="Founded year" htmlFor="foundedYear">
                <Input id="foundedYear" name="foundedYear" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={vendor.foundedYear ?? ""} />
              </Field>
            </div>
          </fieldset>
          <FormError message={error} />
          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({ vendor }: { vendor: VendorProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Verification</dt>
            <dd className={vendor.status === "approved" ? "font-medium text-success" : vendor.status === "pending" ? "font-medium" : "font-medium text-destructive"}>{VENDOR_STATUS_LABEL[vendor.status]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Subscription</dt>
            <dd className="font-medium">{vendor.subscribed ? `Valid until ${formatDateTime(vendor.subscriptionUntil)}` : "Not active — contact EarthClique"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rating</dt>
            <dd className="flex items-center gap-1 font-medium">
              {vendor.ratingCount > 0 ? (
                <>
                  <Star className="size-4 fill-warning text-warning" /> {vendor.ratingAvg.toFixed(1)} <span className="text-muted-foreground">({vendor.ratingCount})</span>
                </>
              ) : (
                "No ratings yet"
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function DocumentsCard({ canUpload }: { canUpload: boolean }) {
  const { data: docs, mutate } = useApi<VendorDocument[]>("/vendor/documents", "vendor");
  const [docType, setDocType] = useState<DocType>("gst");
  const [uploading, setUploading] = useState(false);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return toast.error("Choose a file to upload");
    const label = String(f.get("label") ?? "").trim();
    setUploading(true);
    try {
      await uploadFile(`/vendor/documents?docType=${docType}&label=${encodeURIComponent(label)}`, file);
      form.reset();
      await mutate();
      toast.success("Document uploaded — EarthClique will verify it");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification documents</CardTitle>
        <CardDescription>GST certificate, PAN and company registration are needed before you can quote. Image or PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!docs ? (
          <Skeleton className="h-16 w-full" />
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {DOC_LABEL[d.docType]}
                    {d.label && <span className="font-normal text-muted-foreground"> · {d.label}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Uploaded {formatDateTime(d.createdAt)}</p>
                </div>
                {d.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5" /> Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Awaiting review</span>
                )}
                <a href={fileUrl(d.url, "vendor")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Open <ExternalLink className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <form onSubmit={onUpload} className="space-y-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Document type" htmlFor="docType">
                <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                  <SelectTrigger id="docType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOC_LABEL) as DocType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {DOC_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Label (optional)" htmlFor="label">
                <Input id="label" name="label" maxLength={80} placeholder="e.g. Hikvision partner 2026" />
              </Field>
            </div>
            <Field label="File" htmlFor="file">
              <Input id="file" name="file" type="file" accept="image/*,application/pdf" required />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={uploading}>
                <Upload /> {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
