import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EngineerReview } from "./engineer-review";

export const metadata: Metadata = { title: "Engineer" };

export default function EngineerPage({ params }: PageProps<"/admin/engineers/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EngineerReview params={params} />
    </Suspense>
  );
}
