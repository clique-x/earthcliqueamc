import type { ReactNode } from "react";
import { VendorShell } from "./vendor-shell";

export default function VendorPortalLayout({ children }: { children: ReactNode }) {
  return <VendorShell>{children}</VendorShell>;
}
