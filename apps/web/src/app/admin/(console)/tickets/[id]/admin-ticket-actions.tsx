"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { TicketDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Candidate = { id: string; name: string; phone: string; isOnline: boolean; distanceKm: number | null; busy: boolean };

const RESPONSE_LABEL: Record<string, string> = { accepted: "Accepted", declined: "Declined", timeout: "No answer", cancelled: "Withdrawn" };

export function AdminTicketActions({ ticket: t, refresh }: { ticket: TicketDetail; refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function run(path: string, body: unknown, success: string) {
    setBusy(true);
    try {
      await api(`/admin/tickets/${t.id}/${path}`, { method: "POST", body });
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canAssign = t.status === "SEARCHING" || t.status === "UNASSIGNED";
  const canRedispatch = ["UNASSIGNED", "ASSIGNED", "EN_ROUTE"].includes(t.status);
  const canCancel = ["OPEN", "SEARCHING", "UNASSIGNED", "ASSIGNED", "EN_ROUTE", "ON_HOLD"].includes(t.status);
  const canClose = t.status === "RESOLVED" || t.status === "REMOTE_RESOLVED";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ops actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {canAssign && (
            <Button className="w-full" onClick={() => setAssignOpen(true)} disabled={busy}>
              Assign engineer
            </Button>
          )}
          {canRedispatch && (
            <Button className="w-full" variant="outline" disabled={busy} onClick={() => run("redispatch", undefined, "Dispatch restarted")}>
              Re-dispatch (ring engineers again)
            </Button>
          )}
          {canClose && (
            <Button className="w-full" variant="outline" disabled={busy} onClick={() => run("close", undefined, "Ticket closed")}>
              Close on company&apos;s behalf
            </Button>
          )}
          {t.status === "CLOSED" && !t.paid && (
            <Button className="w-full" variant="outline" disabled={busy} onClick={() => run("mark-paid", undefined, "Marked as paid")}>
              Mark as paid
            </Button>
          )}
          {canCancel && (
            <ReasonDialog
              trigger={
                <Button className="w-full text-destructive" variant="ghost" disabled={busy}>
                  Cancel ticket
                </Button>
              }
              title="Cancel this ticket?"
              confirm="Cancel ticket"
              destructive
              onSubmit={(reason) => run("cancel", { reason }, "Ticket cancelled")}
            />
          )}
          {!canAssign && !canRedispatch && !canClose && !canCancel && t.paid && <p className="text-sm text-muted-foreground">No actions available.</p>}
        </CardContent>
      </Card>

      {t.offers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dispatch log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {t.offers.map((o) => (
              <div key={o.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  R{o.round} · W{o.wave + 1} · {o.distanceKm.toFixed(1)} km
                </span>
                <span>
                  {o.response ? RESPONSE_LABEL[o.response] : "Ringing"} <span className="text-muted-foreground">{formatTime(o.respondedAt ?? o.sentAt)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AssignDialog
        ticketId={t.id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssign={async (engineerId) => {
          await run("assign", { engineerId }, "Engineer assigned");
          setAssignOpen(false);
        }}
      />
    </>
  );
}

function AssignDialog({ ticketId, open, onOpenChange, onAssign }: { ticketId: string; open: boolean; onOpenChange: (o: boolean) => void; onAssign: (id: string) => void }) {
  const { data } = useApi<Candidate[]>(open ? `/admin/tickets/${ticketId}/candidates` : null, "admin");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign an engineer</DialogTitle>
          <DialogDescription>Approved engineers with the right skill, nearest first. They&apos;ll be notified immediately.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {data?.length === 0 && <p className="text-sm text-muted-foreground">No approved engineers have this skill yet.</p>}
          {data?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <div className="flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground">
                  {c.phone} · {c.distanceKm === null ? "location unknown" : `${c.distanceKm} km`} · {c.isOnline ? "online" : "offline"}
                  {c.busy && " · on another job"}
                </p>
              </div>
              <Button size="sm" disabled={c.busy} onClick={() => onAssign(c.id)}>
                Assign
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
