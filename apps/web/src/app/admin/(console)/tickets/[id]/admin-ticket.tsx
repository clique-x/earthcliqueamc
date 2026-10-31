"use client";

import { use } from "react";
import { TicketDetailView } from "@/components/ticket-detail-view";
import { AdminTicketActions } from "./admin-ticket-actions";

export function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TicketDetailView ticketId={id} audience="admin" renderActions={(t, refresh) => <AdminTicketActions ticket={t} refresh={refresh} />} />;
}
