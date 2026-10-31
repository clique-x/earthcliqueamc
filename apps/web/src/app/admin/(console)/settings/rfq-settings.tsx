"use client";

import { rfqConfigSchema, type RfqConfig } from "@amc/shared";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";

export function RfqSettings() {
  const { data, mutate } = useApi<RfqConfig>("/admin/rfq-config", "admin", { revalidateOnFocus: false });
  if (!data) return <Skeleton className="h-72 w-full max-w-3xl" />;
  return <RfqSettingsForm initial={data} onSaved={(saved) => mutate(saved)} />;
}

function RfqSettingsForm({ initial, onSaved }: { initial: RfqConfig; onSaved: (cfg: RfqConfig) => void }) {
  const [cfg, setCfg] = useState<RfqConfig>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bidsId = useId();

  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save() {
    const parsed = rfqConfigSchema.safeParse(cfg);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(`${issue?.path.join(".")}: ${issue?.message}`);
    }
    if (parsed.data.minDeadlineDays > parsed.data.maxDeadlineDays) return setError("Minimum deadline must not be longer than the maximum deadline");
    setSaving(true);
    setError(null);
    try {
      await api("/admin/rfq-config", { method: "PUT", body: parsed.data });
      onSaved(parsed.data);
      toast.success("Project quotation settings saved — they apply to new requirements");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project quotation settings</CardTitle>
          <CardDescription>How many vendors a requirement reaches, how many quotes it accepts, and how long companies can keep it open.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Max quotes per requirement" hint="Once this many active quotes are in, late vendors can't submit.">
              <Input type="number" min={1} max={50} value={cfg.maxQuotes} onChange={(e) => setCfg({ ...cfg, maxQuotes: num(e.target.value) })} />
            </Field>
            <Field label="Max vendors invited" hint="Best-rated matching vendors are invited first.">
              <Input type="number" min={1} max={500} value={cfg.maxInvites} onChange={(e) => setCfg({ ...cfg, maxInvites: num(e.target.value) })} />
            </Field>
            <Field label="Minimum quote deadline (days)">
              <Input type="number" min={1} max={30} value={cfg.minDeadlineDays} onChange={(e) => setCfg({ ...cfg, minDeadlineDays: num(e.target.value) })} />
            </Field>
            <Field label="Maximum quote deadline (days)">
              <Input type="number" min={2} max={180} value={cfg.maxDeadlineDays} onChange={(e) => setCfg({ ...cfg, maxDeadlineDays: num(e.target.value) })} />
            </Field>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor={bidsId}>Allow EarthClique&apos;s own vendor account to bid</Label>
              <p className="text-xs text-muted-foreground">
                When on, vendors marked &ldquo;EarthClique&apos;s own vendor&rdquo; are matched like any other. EarthClique then competes with the vendors it vets, so keep this off unless the conflict of interest has been disclosed to companies.
              </p>
            </div>
            <Switch id={bidsId} checked={cfg.earthcliqueBids} onCheckedChange={(earthcliqueBids) => setCfg({ ...cfg, earthcliqueBids })} />
          </div>

          <FormError message={error} />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
