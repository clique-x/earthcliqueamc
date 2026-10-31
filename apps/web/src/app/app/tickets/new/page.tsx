import type { Metadata } from "next";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "Raise a ticket" };

export default function NewTicketPage() {
  return <NewTicketForm />;
}
