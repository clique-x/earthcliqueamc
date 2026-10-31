"use client";

import { INDIAN_STATES, PROJECT_CATEGORIES, PROJECT_CATEGORY_INFO, vendorSignupSchema, type ProjectCategory } from "@amc/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { clearApiCache } from "@/lib/use-api";

export function VendorSignupForm() {
  const router = useRouter();
  const [state, setState] = useState<string>("");
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleCategory(c: ProjectCategory, on: boolean) {
    setCategories((prev) => (on ? [...prev, c] : prev.filter((x) => x !== c)));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = vendorSignupSchema.safeParse({
      vendorName: f.get("vendorName"),
      gstin: f.get("gstin"),
      city: f.get("city"),
      state,
      categories,
      name: f.get("name"),
      email: f.get("email"),
      phone: f.get("phone"),
      password: f.get("password"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.path[0] === "state" ? "Choose your state" : issue?.path[0] === "categories" ? "Pick at least one category" : (issue?.message ?? "Check the form"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api("/auth/vendor/signup", { body: parsed.data });
      await clearApiCache();
      toast.success("Welcome — upload your documents so we can verify you");
      router.replace("/vendor/profile");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Register as a vendor</CardTitle>
          <CardDescription>Receive matching project requirements in the states you serve and quote with line items.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Vendor / company name" htmlFor="vendorName">
              <Input id="vendorName" name="vendorName" required minLength={2} maxLength={120} autoComplete="organization" />
            </Field>
            <Field label="GSTIN" htmlFor="gstin" hint="15 characters, as on your GST certificate">
              <Input id="gstin" name="gstin" required minLength={15} maxLength={15} className="uppercase" autoCapitalize="characters" spellCheck={false} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="city">
                <Input id="city" name="city" required minLength={2} maxLength={80} autoComplete="address-level2" />
              </Field>
              <Field label="State" htmlFor="state">
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger id="state" className="w-full">
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What kind of work do you do?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_CATEGORIES.map((c) => {
                  const info = PROJECT_CATEGORY_INFO[c];
                  const id = `cat-${c}`;
                  return (
                    <Label key={c} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary/60 has-data-checked:bg-primary/5">
                      <Checkbox id={id} checked={categories.includes(c)} onCheckedChange={(v) => toggleCategory(c, v === true)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{info.label}</span>
                        <span className="block text-xs text-muted-foreground">{info.description}</span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </fieldset>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Your account</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="name">
                  <Input id="name" name="name" required minLength={2} maxLength={80} autoComplete="name" />
                </Field>
                <Field label="Mobile number" htmlFor="phone">
                  <Input id="phone" name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="98XXXXXXXX" autoComplete="tel-national" />
                </Field>
              </div>
              <div className="mt-4 space-y-4">
                <Field label="Work email" htmlFor="email">
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </Field>
                <Field label="Password" htmlFor="password" hint="At least 8 characters">
                  <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                </Field>
              </div>
            </div>

            <FormError message={error} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create vendor account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href="/vendor/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
