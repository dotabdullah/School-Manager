import { invoke } from "@tauri-apps/api/core";

/**
 * Returns this machine's hardware ID (e.g. "SCH-HW-4AF901"). Used to node-lock
 * licenses so a school can't copy the app/database onto another PC and keep
 * using an activated license there.
 *
 * Falls back to a fixed placeholder when running in a plain browser (e.g. `npm run dev`
 * without Tauri) since the native command isn't available there.
 */
export async function getHardwareId(): Promise<string> {
  try {
    return await invoke<string>("get_hardware_id");
  } catch {
    return "SCH-HW-DEVMODE";
  }
}
