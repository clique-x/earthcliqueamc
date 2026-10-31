"use client";

import { siteCreateSchema } from "@amc/shared";
import { LocateFixed, MapPin, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field, FormError } from "@/components/forms/field";
import { MapView } from "@/components/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import type { LatLng, Site } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export function SitesManager() {
  const { data: sites, mutate } = useApi<Site[]>("/company/sites", "company");
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Sites"
        description="Offices, branches or plants where engineers may be sent."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Add site
          </Button>
        }
      />
      {!sites ? (
        <Skeleton className="h-40 w-full" />
      ) : sites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto size-8 text-primary" />
            <p className="mt-2 font-medium">Add your first site</p>
            <p className="mt-1 text-sm text-muted-foreground">Pin its location on the map so we can send the nearest engineer.</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              Add site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            {sites.map((s) => (
              <Card key={s.id}>
                <CardContent className="py-4 text-sm">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-muted-foreground">{s.address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Contact: {s.contactName}, {s.contactPhone}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <MapView markers={sites.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, tone: "primary", label: s.label, size: "lg" }))} fitKey={String(sites.length)} className="h-[420px]" />
        </div>
      )}
      <AddSiteDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async () => {
          setOpen(false);
          await mutate();
          toast.success("Site added");
        }}
      />
    </>
  );
}

function AddSiteDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser can't share location — click the map instead");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — click the map instead");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!point) return setError("Pin the site on the map");
    const f = new FormData(e.currentTarget);
    const parsed = siteCreateSchema.safeParse({
      label: f.get("label"),
      address: f.get("address"),
      contactName: f.get("contactName"),
      contactPhone: f.get("contactPhone"),
      ...point,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
    setPending(true);
    setError(null);
    try {
      await api("/company/sites", { body: parsed.data });
      setPoint(null);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a site</DialogTitle>
          <DialogDescription>Click the map to drop a pin at the entrance, or use your current location.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <MapView markers={point ? [{ id: "pin", ...point, tone: "primary", size: "lg" }] : []} center={point ?? undefined} onPick={setPoint} className="h-64" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No pin yet"}</span>
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
                <LocateFixed /> {locating ? "Locating…" : "Use my location"}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="label">
              <Input id="label" name="label" required placeholder="Head office" />
            </Field>
            <Field label="Address" htmlFor="address">
              <Input id="address" name="address" required placeholder="Building, street, area" />
            </Field>
            <Field label="On-site contact" htmlFor="contactName">
              <Input id="contactName" name="contactName" required />
            </Field>
            <Field label="Contact mobile" htmlFor="contactPhone">
              <Input id="contactPhone" name="contactPhone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save site"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
