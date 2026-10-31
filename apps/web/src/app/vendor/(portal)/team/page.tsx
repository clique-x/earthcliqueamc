import type { Metadata } from "next";
import { VendorTeam } from "./vendor-team";

export const metadata: Metadata = { title: "Team" };

export default function VendorTeamPage() {
  return <VendorTeam />;
}
