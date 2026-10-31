"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ReasonDialog } from "@/components/reason-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, uploadFile } from "@/lib/api";
import type { TicketDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

const CANCELLABLE = ["SEARCHING", "UNASSIGNED", "ASSIGNED", "EN_ROUTE"];

export function CompanyTicketActions({ ticket: t, refresh }: { ticket: TicketDetail; refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);

  async function run(path: string, body: unknown, success: string) {
    setBusy(true);
    try {
      await api(`/company/tickets/${t.id}/${path}`, { method: "POST", body });
      toast.success(success);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const resolved = t.status === "RESOLVED" || t.status === "REMOTE_RESOLVED";
  const rated = t.ratings.some((r) => r.fromType === "company");

  return (
    <>
      {resolved && (
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle>Is it fixed?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t.status === "REMOTE_RESOLVED" ? "The engineer says they fixed it remotely." : "The engineer has marked the work as done."} Please check and confirm.
            </p>
            <Button className="w-full" disabled={busy} onClick={() => run("confirm", undefined, "Ticket closed")}>
              Yes, it&apos;s fixed
            </Button>
            <ReasonDialog
              trigger={
                <Button variant="outline" className="w-full" disabled={busy}>
                  {t.status === "REMOTE_RESOLVED" ? "Not fixed — send someone" : "Not fixed yet"}
                </Button>
              }
              title="What's still wrong?"
              confirm="Reopen ticket"
              onSubmit={(reason) => run("reopen", { reason }, "Ticket reopened")}
            />
          </CardContent>
        </Card>
      )}

      {t.status === "CLOSED" && t.engineer && !rated && <RateCard onSubmit={(score, comment) => run("rating", { score, comment }, "Thanks for the feedback")} />}

      {!["CLOSED", "CANCELLED"].includes(t.status) && (
        <Card>
          <CardHeader>
            <CardTitle>Add a photo</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await uploadFile(`/company/tickets/${t.id}/media`, file);
                  toast.success("Photo added");
                  await refresh();
                } catch (err) {
                  toast.error(errorMessage(err));
                }
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>
      )}

      {CANCELLABLE.includes(t.status) && (
        <ReasonDialog
          trigger={
            <Button variant="ghost" className="w-full text-destructive" disabled={busy}>
              Cancel ticket
            </Button>
          }
          title="Cancel this ticket?"
          description={t.engineer ? `${t.engineer.name} will be told the job is cancelled.` : "We'll stop looking for an engineer."}
          confirm="Cancel ticket"
          destructive
          onSubmit={(reason) => run("cancel", { reason }, "Ticket cancelled")}
        />
      )}
    </>
  );
}

function RateCard({ onSubmit }: { onSubmit: (score: number, comment: string) => void }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate the engineer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
              <Star className={cn("size-7", n <= score ? "fill-warning text-warning" : "text-muted-foreground")} />
            </button>
          ))}
        </div>
        <Textarea placeholder="Comments (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} />
        <Button className="w-full" disabled={score === 0} onClick={() => onSubmit(score, comment)}>
          Submit rating
        </Button>
      </CardContent>
    </Card>
  );
}
