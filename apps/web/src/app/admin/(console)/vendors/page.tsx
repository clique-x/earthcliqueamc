import type { Metadata } from "next";
import { VendorList } from "./vendor-list";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorList />;
}
