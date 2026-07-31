import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";

export interface LicenseLogEntry {
  licenseId: string;
  school: string;
  hardwareIds: string[];
  stationPlan: string;
  issuedAt: string;
  expiryDate: string;
  plan: string;
  features?: string[];
}

const LOG_FILENAME = "license-log.json";

async function logPath(): Promise<string> {
  const dir = await appLocalDataDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return join(dir, LOG_FILENAME);
}

export async function getLicenseLog(): Promise<LicenseLogEntry[]> {
  const path = await logPath();
  if (!(await exists(path))) return [];
  try {
    const raw = await readTextFile(path);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function logIssuedLicense(entry: LicenseLogEntry): Promise<void> {
  const log = await getLicenseLog();
  log.unshift(entry); // newest first
  await writeTextFile(await logPath(), JSON.stringify(log, null, 2));
}
