import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { getHardwareId } from "./hardware";
import { decodeActivationKey, LicenseFile, LicensePayload, FEATURE_KEYS, StationPlan } from "./licenseFormat";

// PASTE the public key printed by `npm run generate-keypair` here.
// This is safe to ship inside the app — it can only VERIFY licenses, never create them.
const PUBLIC_KEY_B64 = "BmrVPxRMrE8gnvrQtxoUxFlGjS0K9g8PnXdKFqUWt/w=";

const LICENSE_FILENAME = "license.json";

export type LicenseInvalidReason =
  | "missing"
  | "invalid_signature"
  | "expired"
  | "hardware_mismatch"
  | "corrupt";

export type LicenseCheckResult =
  | { valid: true; payload: LicensePayload; daysRemaining: number }
  | { valid: false; reason: LicenseInvalidReason };

async function licensePath(): Promise<string> {
  return join(await appLocalDataDir(), LICENSE_FILENAME);
}

async function verifyLicenseFile(file: LicenseFile): Promise<LicenseCheckResult> {
  // Verify against the payload exactly as signed — for licenses issued before
  // feature-gating (or multi-station) existed, that means those keys are absent.
  // Adding them first would change the signed message and break every previously-issued license.
  const message = naclUtil.decodeUTF8(JSON.stringify(file.payload));
  const signature = naclUtil.decodeBase64(file.signature);
  const publicKey = naclUtil.decodeBase64(PUBLIC_KEY_B64);

  if (!nacl.sign.detached.verify(message, signature, publicKey)) {
    return { valid: false, reason: "invalid_signature" };
  }

  const currentHardwareId = await getHardwareId();
  const raw = file.payload as any;
  const stationPlan: StationPlan = raw.stationPlan ?? "1"; // legacy licenses were always single-station

  if (stationPlan !== "unlimited") {
    // New format: hardwareIds[]. Legacy format: single hardwareId string.
    const authorizedIds: string[] = raw.hardwareIds ?? (raw.hardwareId ? [raw.hardwareId] : []);
    if (!authorizedIds.includes(currentHardwareId)) {
      return { valid: false, reason: "hardware_mismatch" };
    }
  }

  const expiry = new Date(file.payload.expiryDate);
  const daysRemaining = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) return { valid: false, reason: "expired" };

  // Backward compatible: fill in fields that didn't exist on older licenses.
  // Safe to do here — verification above already passed against the original signed bytes.
  const payload: LicensePayload = {
    ...file.payload,
    features: raw.features ?? [...FEATURE_KEYS],
    stationPlan,
    hardwareIds: raw.hardwareIds ?? (raw.hardwareId ? [raw.hardwareId] : []),
  };

  return { valid: true, payload, daysRemaining };
}

/** Call on app startup, and anywhere you need to gate a feature behind an active license. Works fully offline. */
export async function checkLicense(): Promise<LicenseCheckResult> {
  const path = await licensePath();
  if (!(await exists(path))) return { valid: false, reason: "missing" };

  let file: LicenseFile;
  try {
    file = JSON.parse(await readTextFile(path));
  } catch {
    return { valid: false, reason: "corrupt" };
  }
  return verifyLicenseFile(file);
}

/** Called when the school pastes the activation key you generated for their hardware ID. */
export async function activateWithKey(activationKey: string): Promise<LicenseCheckResult> {
  const file = decodeActivationKey(activationKey);
  const result = await verifyLicenseFile(file);
  if (!result.valid) return result;

  const path = await licensePath();
  await writeTextFile(path, JSON.stringify(file));
  return result;
}
