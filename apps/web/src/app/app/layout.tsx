import { CompanyShell } from "./company-shell";

export default function CompanyLayout({ children }: LayoutProps<"/app">) {
  return <CompanyShell>{children}</CompanyShell>;
}
