"use client";

import { CATEGORIES, dispatchConfigSchema, type DispatchConfig } from "@amc/shared";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { categoryLabel } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export function DispatchSettings() {
  const { data, mutate } = useApi<DispatchConfig>("/admin/dispatch-config", "admin", { revalidateOnFocus: false });
  if (!data) return <Skeleton className="h-96 w-full" />;
  return <DispatchSettingsForm initial={data} onSaved={(saved) => mutate(saved)} />;
}

function DispatchSettingsForm({ initial, onSaved }: { initial: DispatchConfig; onSaved: (cfg: DispatchConfig) => void }) {
  const [cfg, setCfg] = useState<DispatchConfig>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v === "" ? 0 : Number(v));
  const setWave = (i: number, key: keyof DispatchConfig["waves"][number], value: number) =>
    setCfg({ ...cfg, waves: cfg.waves.map((w, j) => (j === i ? { ...w, [key]: value } : w)) });

  async function save() {
    const parsed = dispatchConfigSchema.safeParse(cfg);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(`${issue?.path.join(".")}: ${issue?.message}`);
    }
    setSaving(true);
    setError(null);
    try {
      await api("/admin/dispatch-config", { method: "PUT", body: parsed.data });
      onSaved(parsed.data);
      toast.success("Dispatch settings saved — they apply to new waves immediately");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Dispatch settings" description="How far and how many engineers we ring, and what we charge." />

      <Card>
        <CardHeader>
          <CardTitle>Ring waves</CardTitle>
          <CardDescription>Each wave rings the nearest eligible engineers who haven&apos;t been rung yet. If no one accepts before the timeout, the next wave starts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {cfg.waves.map((w, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-end gap-3">
              <span className="pb-2 text-sm font-medium">#{i + 1}</span>
              <Field label="Radius (km)">
                <Input type="number" min={1} value={w.radiusKm} onChange={(e) => setWave(i, "radiusKm", num(e.target.value))} />
              </Field>
              <Field label="Max engineers">
                <Input type="number" min={1} value={w.maxEngineers} onChange={(e) => setWave(i, "maxEngineers", num(e.target.value))} />
              </Field>
              <Field label="Timeout (sec)">
                <Input type="number" min={10} value={w.timeoutSec} onChange={(e) => setWave(i, "timeoutSec", num(e.target.value))} />
              </Field>
              <Button variant="ghost" size="icon" disabled={cfg.waves.length === 1} onClick={() => setCfg({ ...cfg, waves: cfg.waves.filter((_, j) => j !== i) })} aria-label="Remove wave">
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={cfg.waves.length >= 6}
            onClick={() => {
              const last = cfg.waves[cfg.waves.length - 1]!;
              setCfg({ ...cfg, waves: [...cfg.waves, { radiusKm: last.radiusKm * 2, maxEngineers: last.maxEngineers, timeoutSec: last.timeoutSec }] });
            }}
          >
            <Plus /> Add wave
          </Button>
          <Field label="Ignore engineers whose location is older than (min)">
            <Input type="number" className="max-w-32" value={cfg.staleLocationMin} onChange={(e) => setCfg({ ...cfg, staleLocationMin: num(e.target.value) })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visit fees (₹)</CardTitle>
          <CardDescription>Shown to engineers on the ring and used as the base charge.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Field key={c} label={categoryLabel(c)}>
              <Input type="number" min={0} value={cfg.fees[c]} onChange={(e) => setCfg({ ...cfg, fees: { ...cfg.fees, [c]: num(e.target.value) } })} />
            </Field>
          ))}
          <Field label="Remote fix">
            <Input type="number" min={0} value={cfg.fees.remote} onChange={(e) => setCfg({ ...cfg, fees: { ...cfg.fees, remote: num(e.target.value) } })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Parts above this amount need company approval (₹)">
            <Input type="number" min={0} value={cfg.partsApprovalThreshold} onChange={(e) => setCfg({ ...cfg, partsApprovalThreshold: num(e.target.value) })} />
          </Field>
          <Field label="Auto-close resolved tickets after (hours)">
            <Input type="number" min={1} value={cfg.autoCloseHours} onChange={(e) => setCfg({ ...cfg, autoCloseHours: num(e.target.value) })} />
          </Field>
          <Field label="Cancellations allowed before cooldown">
            <Input type="number" min={1} value={cfg.cancelCooldown.maxCancels} onChange={(e) => setCfg({ ...cfg, cancelCooldown: { ...cfg.cancelCooldown, maxCancels: num(e.target.value) } })} />
          </Field>
          <Field label="…within (days)">
            <Input type="number" min={1} value={cfg.cancelCooldown.windowDays} onChange={(e) => setCfg({ ...cfg, cancelCooldown: { ...cfg.cancelCooldown, windowDays: num(e.target.value) } })} />
          </Field>
          <Field label="Cooldown length (hours)">
            <Input type="number" min={1} value={cfg.cancelCooldown.cooldownHours} onChange={(e) => setCfg({ ...cfg, cancelCooldown: { ...cfg.cancelCooldown, cooldownHours: num(e.target.value) } })} />
          </Field>
        </CardContent>
      </Card>

      <FormError message={error} />
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
