import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";

const TRIAL_FILENAME = "trial.json";
export const TRIAL_LENGTH_DAYS = 7;

interface TrialFile {
  startedAt: string; // ISO date, set on first-ever launch
}

async function trialPath(): Promise<string> {
  return join(await appLocalDataDir(), TRIAL_FILENAME);
}

/** Starts the trial on first launch (no-op if already started); returns days elapsed/left. */
export async function getTrialStatus(): Promise<{ dayNumber: number; daysLeft: number; expired: boolean }> {
  const path = await trialPath();

  let file: TrialFile;
  if (await exists(path)) {
    file = JSON.parse(await readTextFile(path));
  } else {
    file = { startedAt: new Date().toISOString() };
    await writeTextFile(path, JSON.stringify(file));
  }

  const started = new Date(file.startedAt);
  const daysElapsed = Math.floor((Date.now() - started.getTime()) / (1000 * 60 * 60 * 24));
  const dayNumber = Math.min(daysElapsed + 1, TRIAL_LENGTH_DAYS);
  const daysLeft = Math.max(TRIAL_LENGTH_DAYS - daysElapsed, 0);

  return { dayNumber, daysLeft, expired: daysElapsed >= TRIAL_LENGTH_DAYS };
}
