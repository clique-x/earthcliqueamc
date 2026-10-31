import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyTicket } from "./company-ticket";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage({ params }: PageProps<"/app/tickets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CompanyTicket params={params} />
    </Suspense>
  );
}
