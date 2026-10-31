import type { Metadata } from "next";
import { LiveBoard } from "./live-board";

export const metadata: Metadata = { title: "Live operations" };

export default function AdminHome() {
  return <LiveBoard />;
}
