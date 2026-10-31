export const CATEGORIES = ["pc", "network", "cctv"] as const;
export type Category = (typeof CATEGORIES)[number];

export type TriageQuestion = {
  id: string;
  label: string;
  type: "select" | "text";
  options?: string[];
};

export const CATEGORY_INFO: Record<Category, { label: string; description: string; triage: TriageQuestion[] }> = {
  pc: {
    label: "Windows / PC",
    description: "Won't boot, slow, blue screen, OS install, virus, printer",
    triage: [
      {
        id: "symptom",
        label: "What is happening?",
        type: "select",
        options: ["Won't turn on", "Won't boot / stuck on logo", "Blue screen / crashes", "Very slow", "Virus / pop-ups", "Printer problem", "Software install", "Other"],
      },
      { id: "machines", label: "How many machines are affected?", type: "select", options: ["1", "2–5", "More than 5"] },
      { id: "os", label: "Operating system", type: "select", options: ["Windows 11", "Windows 10", "Older Windows", "Not sure"] },
      { id: "recent_change", label: "Anything changed recently? (update, new software, power cut)", type: "text" },
    ],
  },
  network: {
    label: "Network / Internet",
    description: "No internet, Wi-Fi down, router or switch setup, LAN cabling",
    triage: [
      {
        id: "symptom",
        label: "What is happening?",
        type: "select",
        options: ["No internet for everyone", "No internet for some devices", "Wi-Fi not working", "Very slow internet", "New router / switch setup", "LAN cabling", "Other"],
      },
      { id: "isp_checked", label: "Have you checked with your internet provider?", type: "select", options: ["Yes, their side is fine", "No", "Not sure"] },
      { id: "lights", label: "Router lights (describe colours / blinking)", type: "text" },
    ],
  },
  cctv: {
    label: "CCTV",
    description: "Camera offline, DVR/NVR not recording, mobile view setup",
    triage: [
      {
        id: "symptom",
        label: "What is happening?",
        type: "select",
        options: ["One or more cameras offline", "DVR/NVR not recording", "No mobile / remote view", "Blurry or dark picture", "New camera install", "Other"],
      },
      { id: "camera_count", label: "How many cameras are affected?", type: "select", options: ["1", "2–4", "5 or more", "All"] },
      { id: "recorder", label: "Recorder brand (Hikvision, CP Plus, Dahua...)", type: "text" },
    ],
  },
};
