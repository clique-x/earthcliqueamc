import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewProjectForm } from "./new-project-form";

export const metadata: Metadata = { title: "Post a requirement" };

// Read once per request, outside the component body, so React's purity rule is satisfied.
const requestTime = () => Date.now();

/** Rendered at request time so the deadline defaults can be based on the current date. */
async function FormAtRequestTime() {
  await connection();
  return <NewProjectForm now={requestTime()} />;
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FormAtRequestTime />
    </Suspense>
  );
}
