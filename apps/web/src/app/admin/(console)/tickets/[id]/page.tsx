import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminTicket } from "./admin-ticket";

export const metadata: Metadata = { title: "Ticket" };

export default function AdminTicketPage({ params }: PageProps<"/admin/tickets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AdminTicket params={params} />
    </Suspense>
  );
}
