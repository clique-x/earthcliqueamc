"use client";

import { vendorUserCreateSchema } from "@amc/shared";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field, FormError } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import type { VendorMe } from "@/lib/rfq-types";
import { useApi } from "@/lib/use-api";

type Role = "admin" | "member";
type Member = { id: string; name: string; email: string; phone: string; role: Role };

export function VendorTeam() {
  const { data: members, mutate } = useApi<Member[]>("/vendor/users", "vendor");
  const { data: me } = useApi<VendorMe>("/vendor/me", "vendor");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isAdmin = me?.user.role === "admin";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = vendorUserCreateSchema.safeParse({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), password: f.get("password"), role });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
    setPending(true);
    try {
      await api("/vendor/users", { body: parsed.data });
      setOpen(false);
      setError(null);
      await mutate();
      toast.success("Team member added — share their temporary password with them");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="People at your company who can see requirements and work on quotes."
        actions={
          isAdmin && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> Add member
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="p-0">
          {!members ? (
            <div className="space-y-2 p-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.name}
                        {m.id === me?.user.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.phone}</TableCell>
                      <TableCell className="capitalize">{m.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required minLength={2} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field label="Mobile" htmlFor="phone">
              <Input id="phone" name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Temporary password" htmlFor="password" hint="At least 8 characters">
              <Input id="password" name="password" type="text" required minLength={8} autoComplete="off" />
            </Field>
            <Field label="Role">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member — view requirements and quote</SelectItem>
                  <SelectItem value="admin">Admin — also edit profile, documents and team</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <FormError message={error} />
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
