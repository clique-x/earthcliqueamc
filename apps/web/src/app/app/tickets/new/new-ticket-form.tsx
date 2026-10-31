"use client";

import { CATEGORIES, CATEGORY_INFO, type Category } from "@amc/shared";
import { Cctv, ImagePlus, Monitor, Network } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app-shell";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, uploadFile } from "@/lib/api";
import type { Site } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const ICONS: Record<Category, typeof Monitor> = { pc: Monitor, network: Network, cctv: Cctv };
const MAX_PHOTOS = 4;

export function NewTicketForm() {
  const router = useRouter();
  const { data: sites } = useApi<Site[]>("/company/sites", "company");
  const [siteId, setSiteId] = useState<string>("");
  const [category, setCategory] = useState<Category | null>(null);
  const [triage, setTriage] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedSite = siteId || (sites?.length === 1 ? sites[0]!.id : "");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) return setError("Choose what kind of problem it is");
    if (!selectedSite) return setError("Choose the site where the problem is");
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/company/tickets", {
        body: {
          siteId: selectedSite,
          category,
          priority: urgent ? "urgent" : "normal",
          title: f.get("title"),
          description: f.get("description") ?? "",
          triage: Object.fromEntries(Object.entries(triage).filter(([, v]) => v.trim())),
        },
      });
      // Photos are attached after the ticket exists so dispatch isn't delayed by uploads.
      await Promise.allSettled(photos.map((p) => uploadFile(`/company/tickets/${id}/media`, p)));
      router.push(`/app/tickets/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (sites && sites.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="py-10 text-center">
          <p className="font-medium">Add your first site</p>
          <p className="mt-1 text-sm text-muted-foreground">We need the location of your office or factory to send the nearest engineer.</p>
          <Button asChild className="mt-4">
            <Link href="/app/sites">Add a site</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Raise a ticket" description="Tell us what's wrong — nearby engineers are alerted as soon as you submit." />

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s the problem with?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setTriage({});
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  category === c ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-primary/40",
                )}
              >
                <Icon className="size-6 text-primary" />
                <p className="mt-2 font-medium">{CATEGORY_INFO[c].label}</p>
                <p className="text-xs text-muted-foreground">{CATEGORY_INFO[c].description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {category && (
        <Card>
          <CardHeader>
            <CardTitle>A few quick questions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {CATEGORY_INFO[category].triage.map((q) => (
              <Field key={q.id} label={q.label} htmlFor={`triage-${q.id}`}>
                {q.type === "select" ? (
                  <Select value={triage[q.id] ?? ""} onValueChange={(v) => setTriage((t) => ({ ...t, [q.id]: v }))}>
                    <SelectTrigger id={`triage-${q.id}`} className="w-full">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options!.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id={`triage-${q.id}`} value={triage[q.id] ?? ""} maxLength={500} onChange={(e) => setTriage((t) => ({ ...t, [q.id]: e.target.value }))} />
                )}
              </Field>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Site">
            <Select value={selectedSite} onValueChange={setSiteId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={sites ? "Choose a site" : "Loading sites…"} />
              </SelectTrigger>
              <SelectContent>
                {sites?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} — {s.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Short summary" htmlFor="title">
            <Input id="title" name="title" required minLength={5} maxLength={120} placeholder="e.g. Accounts PC stuck on Windows logo" />
          </Field>
          <Field label="Anything else the engineer should know? (optional)" htmlFor="description">
            <Textarea id="description" name="description" maxLength={2000} rows={3} />
          </Field>
          <div className="space-y-1.5">
            <Label>Photos (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40">
              <ImagePlus className="size-4" />
              {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} selected` : "Add photos of the error screen or device"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={urgent} onCheckedChange={(v) => setUrgent(v === true)} />
            Urgent — work is stopped (we ring a wider circle of engineers straight away)
          </label>
        </CardContent>
      </Card>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !category}>
          {pending ? "Sending…" : "Find an engineer"}
        </Button>
      </div>
    </form>
  );
}
