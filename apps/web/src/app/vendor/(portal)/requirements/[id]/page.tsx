import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorRequirement } from "./vendor-requirement";

export const metadata: Metadata = { title: "Requirement" };

export default function VendorRequirementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <VendorRequirement params={params} />
    </Suspense>
  );
}
