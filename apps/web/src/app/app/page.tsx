import type { Metadata } from "next";
import { TicketList } from "./ticket-list";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return <TicketList />;
}
