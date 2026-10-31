"use client";

import { companyUserCreateSchema } from "@amc/shared";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";

type Member = { id: string; name: string; email: string; phone: string; role: "admin" | "user" };
type Me = { user: { role: "admin" | "user" } };

export function TeamManager() {
  const { data: members, mutate } = useApi<Member[]>("/company/users", "company");
  const { data: me } = useApi<Me>("/company/me", "company");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const isAdmin = me?.user.role === "admin";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = companyUserCreateSchema.safeParse({ name: f.get("name"), email: f.get("email"), phone: f.get("phone"), password: f.get("password"), role });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
    try {
      await api("/company/users", { body: parsed.data });
      setOpen(false);
      setError(null);
      await mutate();
      toast.success("Team member added — share their temporary password with them");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="People in your company who can raise and track tickets."
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
              {members?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{m.phone}</TableCell>
                  <TableCell className="capitalize">{m.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Name" htmlFor="name">
              <Input id="name" name="name" required />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field label="Mobile" htmlFor="phone">
              <Input id="phone" name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label="Temporary password" htmlFor="password" hint="At least 8 characters">
              <Input id="password" name="password" type="text" required minLength={8} />
            </Field>
            <Field label="Role">
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Member — raise and track tickets</SelectItem>
                  <SelectItem value="admin">Admin — also manage sites and team</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <FormError message={error} />
            <div className="flex justify-end">
              <Button type="submit">Add member</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
