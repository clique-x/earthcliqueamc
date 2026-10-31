import type { Metadata } from "next";
import { CompanyList } from "./company-list";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return <CompanyList />;
}
