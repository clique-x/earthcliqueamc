import { CalendarClock, FileText, MapPin, Paperclip, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fileUrl, type Audience } from "@/lib/api";
import { formatDateTime, formatInr } from "@/lib/format";
import type { RequirementDetail } from "@/lib/rfq-types";

/** The requirement as posted: description, structured spec, budget, deadline, site (as much as the viewer may see), attachments. */
export function RequirementBrief({ r, audience }: { r: RequirementDetail; audience: Audience }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {r.description && <p className="whitespace-pre-wrap">{r.description}</p>}
        {r.specLines.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {r.specLines.map((l) => (
              <div key={l.label}>
                <dt className="text-muted-foreground">{l.label}</dt>
                <dd className="font-medium">{l.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <Line icon={CalendarClock} label="Quotes close" value={formatDateTime(r.quoteDeadline)} />
          <Line icon={CalendarClock} label="Work to start by" value={r.startBy ?? "Flexible"} />
          <Line
            icon={Wallet}
            label="Budget"
            value={r.budgetMin === null && r.budgetMax === null ? "Not shared" : `${formatInr(r.budgetMin ?? 0)} – ${r.budgetMax === null ? "open" : formatInr(r.budgetMax)}`}
          />
          <Line icon={FileText} label="Site survey" value={r.surveyAllowed ? "Allowed before quoting" : "Quote from the details given"} />
          <Line
            icon={MapPin}
            label="Location"
            value={
              r.contactRevealed && r.site?.address
                ? `${r.site.label} — ${r.site.address}${r.site.contactName ? `\nContact: ${r.site.contactName}, ${r.site.contactPhone}` : ""}`
                : `${r.city}, ${r.state} (exact address shared when shortlisted)`
            }
          />
        </div>
        {r.attachments.length > 0 && (
          <div className="border-t pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <Paperclip className="size-4" /> Attachments
            </p>
            <ul className="flex flex-wrap gap-2">
              {r.attachments.map((a) => (
                <li key={a.id}>
                  <a href={fileUrl(a.url, audience)} target="_blank" rel="noreferrer" className="rounded-md border px-2.5 py-1 text-xs hover:border-primary/40">
                    {a.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium whitespace-pre-line">{value}</p>
      </div>
    </div>
  );
}
