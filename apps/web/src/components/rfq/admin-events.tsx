import { REQUIREMENT_STATUS_LABELS } from "@amc/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { RequirementDetail } from "@/lib/rfq-types";

const ACTOR_LABEL: Record<RequirementDetail["events"][number]["actorType"], string> = {
  company: "Company",
  vendor: "Vendor",
  admin: "Ops",
  system: "System",
};

/** Status changes and system notes for a requirement, oldest first. */
export function AdminEventTimeline({ events }: { events: RequirementDetail["events"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{ACTOR_LABEL[e.actorType]}</span>
                    {e.toStatus && (
                      <>
                        {" "}
                        → <span className="font-medium">{REQUIREMENT_STATUS_LABELS[e.toStatus]}</span>
                      </>
                    )}
                    {e.note && <span className="text-muted-foreground">{e.toStatus ? ` — ${e.note}` : ` ${e.note}`}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
