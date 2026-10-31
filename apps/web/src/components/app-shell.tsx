"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api, LOGIN_PATHS, type Audience } from "@/lib/api";
import { clearApiCache } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; exact?: boolean };

function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ audience, title, items, account, children }: { audience: Audience; title: string; items: NavItem[]; account?: ReactNode; children: ReactNode }) {
  const router = useRouter();

  async function logout() {
    await api(`/auth/${audience}/logout`, { method: "POST" }).catch(() => {});
    await clearApiCache();
    router.replace(LOGIN_PATHS[audience]);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">EC</span>
            <span className="hidden sm:inline">{title}</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            <Suspense fallback={null}>
              <NavLinks items={items} />
            </Suspense>
          </nav>
          <div className="hidden text-sm text-muted-foreground md:block">{account}</div>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
