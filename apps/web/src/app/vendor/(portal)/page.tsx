import type { Metadata } from "next";
import { RequirementList } from "./requirement-list";

export const metadata: Metadata = { title: "Requirements" };

export default function VendorDashboardPage() {
  return <RequirementList />;
}
