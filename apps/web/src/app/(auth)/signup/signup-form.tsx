"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/forms/field";
import { AuthFrame } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { clearApiCache } from "@/lib/use-api";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/auth/company/signup", {
        body: {
          companyName: f.get("companyName"),
          gstin: f.get("gstin") || undefined,
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          password: f.get("password"),
        },
      });
      await clearApiCache();
      router.replace("/app/sites");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <AuthFrame>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Register your company</CardTitle>
          <CardDescription>Create an account to raise IT, network and CCTV support requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Company name" htmlFor="companyName">
              <Input id="companyName" name="companyName" required minLength={2} />
            </Field>
            <Field label="GSTIN (optional)" htmlFor="gstin">
              <Input id="gstin" name="gstin" maxLength={15} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" htmlFor="name">
                <Input id="name" name="name" required minLength={2} autoComplete="name" />
              </Field>
              <Field label="Mobile number" htmlFor="phone">
                <Input id="phone" name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="98XXXXXXXX" autoComplete="tel-national" />
              </Field>
            </div>
            <Field label="Work email" htmlFor="email">
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Password" htmlFor="password" hint="At least 8 characters">
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <FormError message={error} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
