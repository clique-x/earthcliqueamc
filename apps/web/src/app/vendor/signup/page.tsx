import type { Metadata } from "next";
import { VendorSignupForm } from "./vendor-signup-form";

export const metadata: Metadata = { title: "Register as a vendor" };

export default function VendorSignupPage() {
  return <VendorSignupForm />;
}
