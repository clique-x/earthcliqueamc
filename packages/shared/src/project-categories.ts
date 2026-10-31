export const PROJECT_CATEGORIES = ["cctv", "network", "servers", "datacenter", "other"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export type SpecField = {
  id: string;
  label: string;
  type: "number" | "select" | "multiselect" | "boolean" | "text";
  options?: string[];
  unit?: string;
  required?: boolean;
  hint?: string;
};

/**
 * Structured requirement forms. Vendors quote against these, so the fields are what make quotes comparable.
 * Values are stored as `spec: Record<string, string | number | boolean | string[]>` on the requirement.
 */
export const PROJECT_CATEGORY_INFO: Record<ProjectCategory, { label: string; description: string; fields: SpecField[] }> = {
  cctv: {
    label: "CCTV & surveillance",
    description: "Camera installation, NVR/DVR, remote viewing, cabling",
    fields: [
      { id: "camera_count", label: "Number of cameras", type: "number", required: true },
      { id: "camera_types", label: "Camera types", type: "multiselect", options: ["Dome", "Bullet", "PTZ", "ANPR / number plate", "Not sure"] },
      { id: "placement", label: "Placement", type: "select", options: ["Indoor", "Outdoor", "Both"], required: true },
      { id: "resolution", label: "Resolution", type: "select", options: ["2 MP", "4 MP", "5 MP", "8 MP (4K)", "Vendor to recommend"] },
      { id: "recording_days", label: "Recording retention", type: "number", unit: "days", hint: "How many days of footage must be kept" },
      { id: "remote_view", label: "Mobile / remote viewing needed", type: "boolean" },
      { id: "cabling", label: "New cabling needed", type: "boolean" },
      { id: "existing_system", label: "Existing system (brand, cameras, recorder)", type: "text" },
    ],
  },
  network: {
    label: "Networking & cabling",
    description: "LAN, Wi-Fi, firewalls, switches, structured cabling",
    fields: [
      { id: "user_count", label: "Number of users / devices", type: "number", required: true },
      { id: "wired_points", label: "Wired network points", type: "number" },
      { id: "wifi", label: "Wi-Fi coverage needed", type: "boolean" },
      { id: "area_sqft", label: "Area to cover", type: "number", unit: "sq ft" },
      { id: "internet_links", label: "Internet connections", type: "number", hint: "How many ISP links to connect" },
      { id: "firewall", label: "Firewall / security appliance", type: "select", options: ["Required", "Not required", "Vendor to recommend"] },
      { id: "existing_equipment", label: "Existing equipment", type: "text" },
    ],
  },
  servers: {
    label: "Servers & workstations",
    description: "Server setup, domain, backups, bulk PCs and laptops",
    fields: [
      { id: "computer_count", label: "Number of computers", type: "number", required: true },
      { id: "server_count", label: "Number of servers", type: "number" },
      {
        id: "workloads",
        label: "What the servers will run",
        type: "multiselect",
        options: ["File server", "Domain / Active Directory", "Email", "ERP / accounting", "Virtualisation", "Backup", "Database", "Other"],
      },
      { id: "os", label: "Operating system", type: "select", options: ["Windows Server", "Linux", "Mixed", "Vendor to recommend"] },
      { id: "new_hardware", label: "Supply new hardware", type: "select", options: ["Yes, supply and install", "Install only, we have hardware", "Mixed"] },
      { id: "backup", label: "Backup / disaster recovery needed", type: "boolean" },
      { id: "existing", label: "Existing setup", type: "text" },
    ],
  },
  datacenter: {
    label: "Data centre & server room",
    description: "Racks, power, cooling, UPS, fire safety, monitoring",
    fields: [
      { id: "rack_count", label: "Number of racks", type: "number", required: true },
      { id: "power_kva", label: "Estimated IT load", type: "number", unit: "kVA" },
      { id: "ups_minutes", label: "UPS backup time", type: "number", unit: "minutes" },
      { id: "cooling", label: "Cooling", type: "select", options: ["Precision AC", "Comfort AC", "In-row cooling", "Vendor to recommend"] },
      { id: "fire_suppression", label: "Fire suppression system", type: "boolean" },
      { id: "monitoring", label: "Environment monitoring (temperature, humidity, access)", type: "boolean" },
      { id: "room_sqft", label: "Room size", type: "number", unit: "sq ft" },
      { id: "compliance", label: "Compliance needs (ISO 27001, Tier level…)", type: "text" },
    ],
  },
  other: {
    label: "Other IT project",
    description: "Anything else — describe the scope",
    fields: [{ id: "scope", label: "Scope of work", type: "text", required: true }],
  },
};

export type SpecValue = string | number | boolean | string[];

/** Human-readable spec lines for display. */
export function describeSpec(category: ProjectCategory, spec: Record<string, SpecValue>): { label: string; value: string }[] {
  return PROJECT_CATEGORY_INFO[category].fields
    .filter((f) => spec[f.id] !== undefined && spec[f.id] !== "" && !(Array.isArray(spec[f.id]) && (spec[f.id] as string[]).length === 0))
    .map((f) => {
      const v = spec[f.id]!;
      const value = Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : `${v}${f.unit ? ` ${f.unit}` : ""}`;
      return { label: f.label, value };
    });
}

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

/** "ALL" in a vendor's states means they serve the whole country. */
export const ALL_INDIA = "ALL";
