import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Ops console" };

export default function AdminLoginPage() {
  return <LoginForm audience="admin" />;
}
