"use client";

import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";

type Company = { id: string; name: string; gstin: string | null; createdAt: string; sites: number; tickets: number };

export function CompanyList() {
  const { data } = useApi<Company[]>("/admin/companies", "admin");
  return (
    <>
      <PageHeader title="Companies" description="Businesses registered on the platform." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Sites</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.gstin ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.sites}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.tickets}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
