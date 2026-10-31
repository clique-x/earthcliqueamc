import type { Metadata } from "next";
import { AdminTicketTable } from "./ticket-table";

export const metadata: Metadata = { title: "Tickets" };

export default function AdminTicketsPage() {
  return <AdminTicketTable />;
}
