import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectReview } from "./project-review";

export const metadata: Metadata = { title: "Requirement" };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProjectReview params={params} />
    </Suspense>
  );
}
