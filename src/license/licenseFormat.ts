// Pure encode/decode helpers for the compact "activation key" format shown in the UI,
// e.g. SCH-4F8A2B-91C3D0-.... Contains no secrets — safe to import from either build.

/** Modules a license can individually enable/disable. Dashboard, Licensing, and Backup are always on. */
export const FEATURE_KEYS = ["students", "teachers", "classes", "fees", "expenses", "finance", "attendance", "payroll"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  students: "Students",
  teachers: "Teachers",
  classes: "Classes",
  fees: "Fee Ledger",
  expenses: "Expenses",
  finance: "Finance Reports",
  attendance: "Attendance",
  payroll: "Payroll & Salaries",
};

/** How many physical PCs a license authorizes. "unlimited" skips hardware-lock verification entirely. */
export const STATION_PLANS = ["1", "3", "unlimited"] as const;
export type StationPlan = (typeof STATION_PLANS)[number];

export const STATION_PLAN_LABELS: Record<StationPlan, string> = {
  "1": "1-Station",
  "3": "3-Station",
  unlimited: "Unlimited Stations",
};

export interface LicensePayload {
  school: string;
  licenseId: string;
  hardwareIds: string[];  // PCs authorized to run this license; ignored when stationPlan is "unlimited"
  stationPlan: StationPlan;
  issuedAt: string;   // ISO date
  expiryDate: string; // ISO date, e.g. "2027-07-24"
  plan: "yearly";
  features: FeatureKey[]; // which modules this school's license unlocks
}

export interface LicenseFile {
  payload: LicensePayload;
  signature: string; // base64, Ed25519 signature of JSON.stringify(payload)
}

/** Packs a signed license into the short dash-grouped key schools paste into the app. */
export function encodeActivationKey(file: LicenseFile): string {
  const json = JSON.stringify(file);
  const base64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const chunks = base64.match(/.{1,6}/g) ?? [];
  return "SCH-" + chunks.join("-");
}

/** Reverses encodeActivationKey — throws if the string isn't well-formed (caller should catch). */
export function decodeActivationKey(key: string): LicenseFile {
  const cleaned = key.trim().replace(/^SCH-/i, "").split("-").join("");
  let base64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const json = decodeURIComponent(escape(atob(base64)));
  return JSON.parse(json);
}
