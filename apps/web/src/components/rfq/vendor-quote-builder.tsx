"use client";

import { GST_RATES, QUOTE_ITEM_KINDS, canTransitionQuote, quoteSaveSchema, quoteSubmitSchema, quoteTotals, type QuoteItemKind } from "@amc/shared";
import { MessageSquareWarning, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/rfq/vendor-confirm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatInr } from "@/lib/format";
import type { QuoteView } from "@/lib/rfq-types";

const KIND_LABEL: Record<QuoteItemKind, string> = { material: "Material", labour: "Labour", service: "Service", other: "Other" };

type Row = {
  key: string;
  kind: QuoteItemKind;
  description: string;
  brandModel: string;
  qty: string;
  unit: string;
  unitPrice: string;
  gstPercent: number;
};

let seq = 0;
const nextKey = () => `row-${++seq}`;

const blankRow = (): Row => ({ key: nextKey(), kind: "material", description: "", brandModel: "", qty: "1", unit: "nos", unitPrice: "", gstPercent: 18 });

function rowsFromQuote(q: QuoteView | null): Row[] {
  if (!q || q.items.length === 0) return [blankRow()];
  return q.items.map((it) => ({
    key: nextKey(),
    kind: it.kind,
    description: it.description,
    brandModel: it.brandModel,
    qty: String(it.qty),
    unit: it.unit,
    unitPrice: String(it.unitPrice),
    gstPercent: it.gstPercent,
  }));
}

type Terms = { timelineDays: string; warrantyMonths: string; paymentTerms: string; validUntil: string; notes: string; surveyRequired: boolean };

const termsFromQuote = (q: QuoteView | null): Terms => ({
  timelineDays: q?.timelineDays === null || q?.timelineDays === undefined ? "" : String(q.timelineDays),
  warrantyMonths: q?.warrantyMonths === null || q?.warrantyMonths === undefined ? "" : String(q.warrantyMonths),
  paymentTerms: q?.paymentTerms ?? "",
  validUntil: q?.validUntil ?? "",
  notes: q?.notes ?? "",
  surveyRequired: q?.surveyRequired ?? false,
});

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const optInt = (s: string) => (s.trim() === "" ? null : Number(s));

/** Turns the first zod issue into something a vendor can act on. */
function issueText(issue: { path: PropertyKey[]; message: string } | undefined): string {
  if (!issue) return "Check the quote";
  const [head, index, field] = issue.path;
  if (head === "items" && typeof index === "number") {
    const label = field === "unitPrice" ? "unit price" : field === "gstPercent" ? "GST" : field === "brandModel" ? "brand / model" : String(field ?? "");
    return `Line ${index + 1}${label ? ` ${label}` : ""}: ${issue.message}`;
  }
  const FIELD: Record<string, string> = { timelineDays: "Timeline", warrantyMonths: "Warranty", paymentTerms: "Payment terms", validUntil: "Valid until", notes: "Notes", items: "Line items" };
  return `${FIELD[String(head)] ?? String(head)}: ${issue.message}`;
}

type Props = {
  requirementId: string;
  /** The vendor's existing quote (null for a first draft); used to pre-fill. Pass a `key` tied to it so a fresh quote remounts the editor. */
  quote: QuoteView | null;
  /** Called after any successful save/submit/withdraw so the page can refetch. */
  onChanged: () => Promise<unknown>;
};

export function VendorQuoteBuilder({ requirementId, quote, onChanged }: Props) {
  const [rows, setRows] = useState<Row[]>(() => rowsFromQuote(quote));
  const [terms, setTerms] = useState<Terms>(() => termsFromQuote(quote));
  const [busy, setBusy] = useState<"save" | "submit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totals = quoteTotals(
    rows.map((r) => {
      const qty = num(r.qty);
      const unitPrice = num(r.unitPrice);
      return { kind: r.kind, description: r.description, qty: Number.isFinite(qty) ? qty : 0, unit: r.unit, unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0, gstPercent: r.gstPercent };
    }),
  );

  function patchRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function payload() {
    return {
      items: rows.map((r) => ({
        kind: r.kind,
        description: r.description,
        brandModel: r.brandModel,
        qty: num(r.qty),
        unit: r.unit.trim() || "nos",
        unitPrice: num(r.unitPrice),
        gstPercent: r.gstPercent,
      })),
      timelineDays: optInt(terms.timelineDays),
      warrantyMonths: optInt(terms.warrantyMonths),
      paymentTerms: terms.paymentTerms,
      validUntil: terms.validUntil || null,
      notes: terms.notes,
      surveyRequired: terms.surveyRequired,
    };
  }

  async function saveDraft() {
    const parsed = quoteSaveSchema.safeParse(payload());
    if (!parsed.success) return setError(issueText(parsed.error.issues[0]));
    setBusy("save");
    setError(null);
    try {
      await api(`/vendor/requirements/${requirementId}/quote`, { method: "PUT", body: parsed.data });
      await onChanged();
      toast.success("Draft saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Returns false (and shows the issue) when the quote is not ready to submit. */
  function validateForSubmit() {
    const parsed = quoteSubmitSchema.safeParse(payload());
    if (!parsed.success) {
      setError(issueText(parsed.error.issues[0]));
      return null;
    }
    setError(null);
    return parsed.data;
  }

  async function submit() {
    const data = validateForSubmit();
    if (!data) return;
    setBusy("submit");
    try {
      await api(`/vendor/requirements/${requirementId}/quote/submit`, { body: data });
      await onChanged();
      toast.success("Quote submitted — the company has been notified");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    setBusy("withdraw");
    try {
      await api(`/vendor/requirements/${requirementId}/quote/withdraw`, { method: "POST" });
      await onChanged();
      toast.success("Quote withdrawn");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const canWithdraw = quote !== null && quote.status !== "DRAFT" && canTransitionQuote(quote.status, "WITHDRAWN", "vendor");
  const submitReady = quoteSubmitSchema.safeParse(payload()).success;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{quote?.status === "REVISION_REQUESTED" ? `Revise your quote (v${quote.version + 1})` : quote ? "Your draft quote" : "Build your quote"}</CardTitle>
        <CardDescription>Itemise materials, labour and services. The company compares quotes line by line, so be specific about brands and models.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {quote?.status === "REVISION_REQUESTED" && quote.revisionNote && (
          <Alert className="border-warning/40 bg-warning/10">
            <MessageSquareWarning />
            <AlertTitle>The company asked for changes</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{quote.revisionNote}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Line {i + 1}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-desc`} className="text-xs">
                    Description
                  </Label>
                  <Input id={`${r.key}-desc`} value={r.description} maxLength={200} placeholder="e.g. 5 MP IP dome camera" onChange={(e) => patchRow(r.key, { description: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-brand`} className="text-xs">
                    Brand / model
                  </Label>
                  <Input id={`${r.key}-brand`} value={r.brandModel} maxLength={120} placeholder="Optional" onChange={(e) => patchRow(r.key, { brandModel: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-kind`} className="text-xs">
                    Kind
                  </Label>
                  <Select value={r.kind} onValueChange={(v) => patchRow(r.key, { kind: v as QuoteItemKind })}>
                    <SelectTrigger id={`${r.key}-kind`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_ITEM_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-qty`} className="text-xs">
                    Qty
                  </Label>
                  <Input id={`${r.key}-qty`} type="number" inputMode="decimal" min={0} step="any" value={r.qty} onChange={(e) => patchRow(r.key, { qty: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-unit`} className="text-xs">
                    Unit
                  </Label>
                  <Input id={`${r.key}-unit`} value={r.unit} maxLength={20} placeholder="nos" onChange={(e) => patchRow(r.key, { unit: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-price`} className="text-xs">
                    Unit price ₹
                  </Label>
                  <Input id={`${r.key}-price`} type="number" inputMode="numeric" min={0} step={1} value={r.unitPrice} onChange={(e) => patchRow(r.key, { unitPrice: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${r.key}-gst`} className="text-xs">
                    GST %
                  </Label>
                  <Select value={String(r.gstPercent)} onValueChange={(v) => patchRow(r.key, { gstPercent: Number(v) })}>
                    <SelectTrigger id={`${r.key}-gst`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GST_RATES.map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          {g}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, blankRow()])}>
            <Plus /> Add line
          </Button>
        </div>

        <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatInr(totals.subtotal)}</dd>
          <dt className="text-muted-foreground">GST</dt>
          <dd className="text-right tabular-nums">{formatInr(totals.gstTotal)}</dd>
          <dt className="border-t pt-1 font-semibold">Total</dt>
          <dd className="border-t pt-1 text-right font-semibold tabular-nums">{formatInr(totals.total)}</dd>
        </dl>

        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium">Terms</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="timelineDays">Timeline (days)</Label>
              <Input id="timelineDays" type="number" inputMode="numeric" min={1} max={730} value={terms.timelineDays} onChange={(e) => setTerms({ ...terms, timelineDays: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warrantyMonths">Warranty (months)</Label>
              <Input id="warrantyMonths" type="number" inputMode="numeric" min={0} max={120} value={terms.warrantyMonths} onChange={(e) => setTerms({ ...terms, warrantyMonths: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validUntil">Quote valid until</Label>
              <Input id="validUntil" type="date" value={terms.validUntil} onChange={(e) => setTerms({ ...terms, validUntil: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paymentTerms">Payment terms</Label>
            <Textarea id="paymentTerms" rows={2} maxLength={1000} placeholder="e.g. 50% advance, 40% on delivery, 10% after handover" value={terms.paymentTerms} onChange={(e) => setTerms({ ...terms, paymentTerms: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes for the company</Label>
            <Textarea id="notes" rows={3} maxLength={3000} placeholder="Assumptions, exclusions, what happens after a site survey…" value={terms.notes} onChange={(e) => setTerms({ ...terms, notes: e.target.value })} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="surveyRequired">Site survey needed before final price</Label>
              <p className="text-xs text-muted-foreground">Tell the company this quote is indicative until you have seen the site.</p>
            </div>
            <Switch id="surveyRequired" checked={terms.surveyRequired} onCheckedChange={(v) => setTerms({ ...terms, surveyRequired: v })} />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {canWithdraw && (
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" disabled={busy !== null} className="mr-auto text-destructive">
                  Withdraw
                </Button>
              }
              title="Withdraw this quote?"
              description="The company will no longer see it and your quote slot is released. You cannot submit again for this requirement."
              confirm="Withdraw quote"
              destructive
              onConfirm={withdraw}
            />
          )}
          <Button type="button" variant="outline" disabled={busy !== null} onClick={saveDraft}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" disabled={busy !== null} onClick={(e) => (validateForSubmit() ? undefined : e.preventDefault())}>
                {busy === "submit" ? "Submitting…" : quote?.status === "REVISION_REQUESTED" ? "Submit revised quote" : "Submit quote"}
              </Button>
            }
            title={`Submit quote for ${formatInr(totals.total)}?`}
            description="You can withdraw later, but the company will be notified now and will see every line item and your terms."
            confirm="Submit quote"
            onConfirm={submit}
          />
          {!submitReady && <p className="w-full text-right text-xs text-muted-foreground">Submitting needs at least one line, a timeline, warranty and payment terms.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
