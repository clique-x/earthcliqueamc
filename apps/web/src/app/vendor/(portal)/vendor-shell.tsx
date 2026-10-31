"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { VendorMe } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/vendor", label: "Requirements", exact: true },
  { href: "/vendor/quotes", label: "My quotes" },
  { href: "/vendor/profile", label: "Profile & verification" },
  { href: "/vendor/team", label: "Team" },
];

function StatusBanner({ me }: { me: VendorMe }) {
  const { vendor } = me;
  if (vendor.status === "pending") {
    return (
      <Alert className="mb-6 border-warning/40 bg-warning/10">
        <ShieldAlert />
        <AlertTitle>Your account is being verified</AlertTitle>
        <AlertDescription>
          Upload your GST certificate, PAN and company registration under{" "}
          <Link href="/vendor/profile" className="font-medium">
            Profile &amp; verification
          </Link>{" "}
          to speed it up.
        </AlertDescription>
      </Alert>
    );
  }
  if (vendor.status === "rejected" || vendor.status === "suspended") {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle />
        <AlertTitle>{vendor.status === "rejected" ? "Your account was not approved" : "Your account is suspended"}</AlertTitle>
        <AlertDescription>{vendor.rejectionReason || "Contact EarthClique for details."}</AlertDescription>
      </Alert>
    );
  }
  if (!vendor.subscribed) {
    return (
      <Alert className="mb-6 border-warning/40 bg-warning/10">
        <AlertTriangle />
        <AlertTitle>Subscription not active</AlertTitle>
        <AlertDescription>An active EarthClique subscription is needed to receive requirements and quote. Contact EarthClique to activate.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function VendorShell({ children }: { children: ReactNode }) {
  const { data } = useApi<VendorMe>("/vendor/me", "vendor");
  return (
    <AppShell audience="vendor" title="Vendor portal" items={NAV} account={data ? `${data.user.name} · ${data.vendor.name}` : null}>
      {data && <StatusBanner me={data} />}
      {children}
    </AppShell>
  );
}
