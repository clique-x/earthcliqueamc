import type { Metadata } from "next";
import { DispatchSettings } from "./dispatch-settings";
import { RfqSettings } from "./rfq-settings";

export const metadata: Metadata = { title: "Dispatch settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <DispatchSettings />
      <RfqSettings />
    </div>
  );
}
