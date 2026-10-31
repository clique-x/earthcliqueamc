"use client";

import { use } from "react";
import { TicketDetailView } from "@/components/ticket-detail-view";
import { CompanyTicketActions } from "./company-ticket-actions";

export function CompanyTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TicketDetailView ticketId={id} audience="company" renderActions={(t, refresh) => <CompanyTicketActions ticket={t} refresh={refresh} />} />;
}
