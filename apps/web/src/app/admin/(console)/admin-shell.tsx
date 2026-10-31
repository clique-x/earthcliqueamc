"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useApi } from "@/lib/use-api";

const NAV = [
  { href: "/admin", label: "Live", exact: true },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/engineers", label: "Engineers" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/settings", label: "Dispatch settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { data } = useApi<{ name: string }>("/admin/me", "admin");
  return (
    <AppShell audience="admin" title="Ops console" items={NAV} account={data?.name}>
      {children}
    </AppShell>
  );
}
