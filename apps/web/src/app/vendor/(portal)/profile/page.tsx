import type { Metadata } from "next";
import { ProfileManager } from "./profile-manager";

export const metadata: Metadata = { title: "Profile & verification" };

export default function VendorProfilePage() {
  return <ProfileManager />;
}
