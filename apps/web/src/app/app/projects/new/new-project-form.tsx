"use client";

import { DEFAULT_RFQ_CONFIG, PROJECT_CATEGORIES, PROJECT_CATEGORY_INFO, requirementCreateSchema, validateSpec, type ProjectCategory, type SpecField } from "@amc/shared";
import { Boxes, Cctv, Database, Network, Paperclip, Server, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, uploadFile } from "@/lib/api";
import type { Site } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const ICONS: Record<ProjectCategory, typeof Cctv> = { cctv: Cctv, network: Network, servers: Server, datacenter: Database, other: Boxes };
const MAX_ATTACHMENTS = 6;
const DAY_MS = 86_400_000;

/** Raw form values before validateSpec coerces them (numbers stay strings while typing). */
type RawSpec = Record<string, string | boolean | string[]>;

const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const optionalInt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : Number(s);
};

/** `now` comes from the server at request time: Next.js forbids `Date.now()` while prerendering client components. */
export function NewProjectForm({ now }: { now: number }) {
  const router = useRouter();
  const daysFromNow = (days: number) => new Date(now + days * DAY_MS);
  const { data: sites } = useApi<Site[]>("/company/sites", "company");
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState<ProjectCategory | null>(null);
  const [spec, setSpec] = useState<RawSpec>({});
  const [deadlineDate, setDeadlineDate] = useState(() => toDateInput(daysFromNow(7)));
  const [deadlineTime, setDeadlineTime] = useState(() => toTimeInput(new Date(now)));
  const [surveyAllowed, setSurveyAllowed] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedSite = siteId || (sites?.length === 1 ? sites[0]!.id : "");
  const minDate = toDateInput(daysFromNow(DEFAULT_RFQ_CONFIG.minDeadlineDays));
  const maxDate = toDateInput(daysFromNow(DEFAULT_RFQ_CONFIG.maxDeadlineDays));

  const setField = (id: string, value: string | boolean | string[]) => setSpec((s) => ({ ...s, [id]: value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) return setError("Choose what kind of project it is");
    if (!selectedSite) return setError("Choose the site where the work will happen");
    const checked = validateSpec(category, spec);
    if (!checked.ok) return setError(checked.message);
    if (!deadlineDate || !deadlineTime) return setError("Set the date and time quotes should close");

    const f = new FormData(e.currentTarget);
    const startBy = f.get("startBy");
    const parsed = requirementCreateSchema.safeParse({
      siteId: selectedSite,
      category,
      title: f.get("title"),
      description: f.get("description") ?? "",
      spec: checked.spec,
      quoteDeadline: new Date(`${deadlineDate}T${deadlineTime}`).toISOString(),
      startBy: typeof startBy === "string" && startBy ? startBy : null,
      budgetMin: optionalInt(f.get("budgetMin")),
      budgetMax: optionalInt(f.get("budgetMax")),
      surveyAllowed,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(issue ? `${issue.path.length ? `${String(issue.path[0])}: ` : ""}${issue.message}` : "Check the form");
    }
    if (parsed.data.budgetMin !== null && parsed.data.budgetMax !== null && parsed.data.budgetMin > parsed.data.budgetMax) {
      return setError("Minimum budget is more than the maximum");
    }

    setPending(true);
    setError(null);
    try {
      const { id } = await api<{ id: string; code: string }>("/company/projects", { body: parsed.data });
      // Attachments go up after the requirement exists so a slow upload never blocks the submission.
      const results = await Promise.allSettled(files.map((file) => uploadFile(`/company/projects/${id}/attachments?name=${encodeURIComponent(file.name)}`, file)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) toast.warning(`${failed} attachment${failed > 1 ? "s" : ""} could not be uploaded — you can add them from the project page.`);
      router.push(`/app/projects/${id}`);
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
          <p className="mt-1 text-sm text-muted-foreground">Vendors are matched by the state your site is in, so we need its address first.</p>
          <Button asChild className="mt-4">
            <Link href="/app/sites">Add a site</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Post a requirement" description="Describe the job once — verified vendors in your state send itemised quotes you can compare." />

      <Card>
        <CardHeader>
          <CardTitle>1. What kind of project is it?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECT_CATEGORIES.map((c) => {
            const Icon = ICONS[c];
            const info = PROJECT_CATEGORY_INFO[c];
            return (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  setSpec({});
                }}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  category === c ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-primary/40",
                )}
              >
                <Icon className="size-6 text-primary" />
                <p className="mt-2 font-medium">{info.label}</p>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {category && (
        <Card>
          <CardHeader>
            <CardTitle>2. Specifications</CardTitle>
            <CardDescription>These make quotes comparable — vendors price against exactly what you enter here.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {PROJECT_CATEGORY_INFO[category].fields.map((field) => (
              <SpecInput key={field.id} field={field} value={spec[field.id]} onChange={(v) => setField(field.id, v)} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{category ? "3." : "2."} Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Site" hint="The address must include the state, e.g. 'Ahmedabad, Gujarat' — vendors are matched by state.">
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
          <Field label="Title" htmlFor="title">
            <Input id="title" name="title" required minLength={5} maxLength={140} placeholder="e.g. 70-camera CCTV system for factory and warehouse" />
          </Field>
          <Field label="Description (optional)" htmlFor="description" hint="Buildings, floors, access hours, anything that affects the price.">
            <Textarea id="description" name="description" maxLength={5000} rows={4} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quotes close on" htmlFor="deadline-date" hint={`Between ${DEFAULT_RFQ_CONFIG.minDeadlineDays} and ${DEFAULT_RFQ_CONFIG.maxDeadlineDays} days from today.`}>
              <div className="flex gap-2">
                <Input id="deadline-date" type="date" required min={minDate} max={maxDate} value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
                <Input aria-label="Quotes close at" type="time" required value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-32" />
              </div>
            </Field>
            <Field label="Work to start by (optional)" htmlFor="startBy">
              <Input id="startBy" name="startBy" type="date" min={minDate} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget from ₹ (optional)" htmlFor="budgetMin">
              <Input id="budgetMin" name="budgetMin" type="number" inputMode="numeric" min={0} step={1} placeholder="e.g. 600000" />
            </Field>
            <Field label="Budget up to ₹ (optional)" htmlFor="budgetMax">
              <Input id="budgetMax" name="budgetMax" type="number" inputMode="numeric" min={0} step={1} placeholder="e.g. 900000" />
            </Field>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">Vendors may visit the site before quoting</span>
              <span className="block text-xs text-muted-foreground">Recommended for cabling and civil work — quotes are more accurate.</span>
            </span>
            <Switch checked={surveyAllowed} onCheckedChange={setSurveyAllowed} aria-label="Vendors may visit the site before quoting" />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="attachments">Attachments (optional)</Label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/40">
              <Paperclip className="size-4" />
              {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : `Floor plans, photos or a PDF brief (up to ${MAX_ATTACHMENTS})`}
              <input
                id="attachments"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="sr-only"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_ATTACHMENTS))}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="rounded-md border px-2 py-0.5">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        EarthClique checks every requirement before vendors see it (usually within one working day).
      </p>

      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !category}>
          {pending ? "Posting…" : "Post requirement"}
        </Button>
      </div>
    </form>
  );
}

function SpecInput({ field, value, onChange }: { field: SpecField; value: string | boolean | string[] | undefined; onChange: (v: string | boolean | string[]) => void }) {
  const id = `spec-${field.id}`;
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === "boolean") {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:self-end">
        <span>
          <span className="font-medium">{label}</span>
          {field.hint && <span className="block text-xs text-muted-foreground">{field.hint}</span>}
        </span>
        <Switch id={id} checked={value === true} onCheckedChange={onChange} />
      </label>
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-sm font-medium">{label}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {field.options!.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.includes(o)} onCheckedChange={(c) => onChange(c === true ? [...selected, o] : selected.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
        </div>
        {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
      </fieldset>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={label} htmlFor={id} hint={field.hint}>
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full" aria-required={field.required}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {field.options!.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (field.type === "text") {
    return (
      <div className="sm:col-span-2">
        <Field label={label} htmlFor={id} hint={field.hint}>
          <Textarea id={id} value={typeof value === "string" ? value : ""} maxLength={1000} rows={3} required={field.required} onChange={(e) => onChange(e.target.value)} />
        </Field>
      </div>
    );
  }

  return (
    <Field label={label} htmlFor={id} hint={field.hint}>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          required={field.required}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(field.unit && "pr-16")}
        />
        {field.unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{field.unit}</span>}
      </div>
    </Field>
  );
}
