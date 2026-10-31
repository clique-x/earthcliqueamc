"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useApi } from "@/lib/use-api";

type Me = { user: { name: string; role: "admin" | "user" }; company: { name: string } };

const NAV = [
  { href: "/app", label: "Tickets", exact: true },
  { href: "/app/tickets/new", label: "Raise ticket" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/sites", label: "Sites" },
  { href: "/app/team", label: "Team" },
];

export function CompanyShell({ children }: { children: ReactNode }) {
  const { data } = useApi<Me>("/company/me", "company");
  return (
    <AppShell audience="company" title="Earthclique AMC" items={NAV} account={data ? `${data.user.name} · ${data.company.name}` : null}>
      {children}
    </AppShell>
  );
}
