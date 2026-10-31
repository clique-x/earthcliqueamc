import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatInr } from "@/lib/format";
import type { QuoteView } from "@/lib/rfq-types";

const KIND_LABEL = { material: "Material", labour: "Labour", service: "Service", other: "Other" } as const;

/** Read-only itemised quote with totals. */
export function QuoteTable({ quote }: { quote: QuoteView }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Brand / model</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">GST</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quote.items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>
                <span className="block font-medium">{it.description}</span>
                <span className="text-xs text-muted-foreground">{KIND_LABEL[it.kind]}</span>
              </TableCell>
              <TableCell className="text-muted-foreground">{it.brandModel || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {it.qty} {it.unit}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatInr(it.unitPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{it.gstPercent}%</TableCell>
              <TableCell className="text-right tabular-nums">{formatInr(it.lineTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="text-right">
              Subtotal
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatInr(quote.subtotal)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5} className="text-right">
              GST
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatInr(quote.gstTotal)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5} className="text-right font-semibold">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatInr(quote.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

/** The non-price terms, shown beside the table. */
export function QuoteTerms({ quote }: { quote: QuoteView }) {
  const rows: [string, string][] = [
    ["Timeline", quote.timelineDays ? `${quote.timelineDays} days` : "—"],
    ["Warranty", quote.warrantyMonths !== null ? `${quote.warrantyMonths} months` : "—"],
    ["Payment terms", quote.paymentTerms || "—"],
    ["Valid until", quote.validUntil ? formatDate(quote.validUntil) : "—"],
    ["Site survey", quote.surveyRequired ? "Needed before final price" : "Not needed"],
  ];
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
      {quote.notes && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Notes</dt>
          <dd className="whitespace-pre-wrap">{quote.notes}</dd>
        </div>
      )}
    </dl>
  );
}
