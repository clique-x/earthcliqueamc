import type { Metadata } from "next";
import { QuoteList } from "./quote-list";

export const metadata: Metadata = { title: "My quotes" };

export default function VendorQuotesPage() {
  return <QuoteList />;
}
