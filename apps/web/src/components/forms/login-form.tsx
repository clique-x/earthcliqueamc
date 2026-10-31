"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/forms/field";
import { AuthFrame } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage, type Audience } from "@/lib/api";
import { clearApiCache } from "@/lib/use-api";

const COPY: Record<Audience, { title: string; description: string; next: string }> = {
  company: { title: "Sign in", description: "Raise and track support tickets for your company.", next: "/app" },
  vendor: { title: "Vendor sign in", description: "Receive project requirements and send quotes.", next: "/vendor" },
  admin: { title: "Ops console", description: "EarthClique operations team sign-in.", next: "/admin" },
};

export function LoginForm({ audience }: { audience: Audience }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const copy = COPY[audience];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api(`/auth/${audience}/login`, { body: { email: form.get("email"), password: form.get("password") } });
      await clearApiCache();
      router.replace(copy.next);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <FormError message={error} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            {audience !== "admin" && (
              <p className="text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link href={audience === "vendor" ? "/vendor/signup" : "/signup"} className="font-medium text-primary hover:underline">
                  {audience === "vendor" ? "Register as a vendor" : "Register your company"}
                </Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
