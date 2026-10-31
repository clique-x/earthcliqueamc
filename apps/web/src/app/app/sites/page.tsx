import type { Metadata } from "next";
import { SitesManager } from "./sites-manager";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return <SitesManager />;
}
