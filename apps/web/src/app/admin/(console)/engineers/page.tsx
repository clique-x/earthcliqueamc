import type { Metadata } from "next";
import { EngineerList } from "./engineer-list";

export const metadata: Metadata = { title: "Engineers" };

export default function EngineersPage() {
  return <EngineerList />;
}
