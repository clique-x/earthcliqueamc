import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Vendor sign in" };

export default function VendorLoginPage() {
  return <LoginForm audience="vendor" />;
}
