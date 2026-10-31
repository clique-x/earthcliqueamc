import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorReview } from "./vendor-review";

export const metadata: Metadata = { title: "Vendor" };

export default function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <VendorReview params={params} />
    </Suspense>
  );
}
