import { readTextFile, writeTextFile, exists, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { buildBackupObject, applyBackupObject, BackupFile } from "./backup";

const DEFAULT_RETENTION_COUNT = 10;
const FILENAME_PREFIX = "backup-";
const FILENAME_SUFFIX = ".json";

export interface AutoBackupEntry {
  filename: string;
  date: string; // "YYYY-MM-DD"
}

async function backupsDir(): Promise<string> {
  const dir = await join(await appLocalDataDir(), "backups");
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return dir;
}

async function configPath(): Promise<string> {
  return join(await backupsDir(), "config.json");
}

/**
 * Retention count lives in its own tiny file inside the backups folder — deliberately
 * NOT in the main data store. If the main store ever gets corrupted, the backup system
 * (and the backups themselves) must keep working independently of it.
 */
export async function getRetentionCount(): Promise<number> {
  try {
    const raw = await readTextFile(await configPath());
    const parsed = JSON.parse(raw);
    return typeof parsed.retentionCount === "number" && parsed.retentionCount > 0 ? parsed.retentionCount : DEFAULT_RETENTION_COUNT;
  } catch {
    return DEFAULT_RETENTION_COUNT;
  }
}

export async function setRetentionCount(count: number): Promise<void> {
  await writeTextFile(await configPath(), JSON.stringify({ retentionCount: Math.max(1, count) }));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lists existing automatic backups, newest first. */
export async function listAutoBackups(): Promise<AutoBackupEntry[]> {
  const dir = await backupsDir();
  const entries = await readDir(dir);
  return entries
    .filter((e) => e.isFile && e.name?.startsWith(FILENAME_PREFIX) && e.name.endsWith(FILENAME_SUFFIX))
    .map((e) => ({
      filename: e.name!,
      date: e.name!.slice(FILENAME_PREFIX.length, e.name!.length - FILENAME_SUFFIX.length),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/**
 * Creates today's backup if one doesn't already exist, then deletes the oldest
 * backups beyond the retention count. Safe to call every time the app starts —
 * it's a no-op if today's backup already exists.
 */
export async function runAutoBackupIfNeeded(): Promise<{ created: boolean }> {
  const dir = await backupsDir();
  const todayFilename = `${FILENAME_PREFIX}${todayISO()}${FILENAME_SUFFIX}`;
  const todayPath = await join(dir, todayFilename);

  let created = false;
  if (!(await exists(todayPath))) {
    const backup = await buildBackupObject();
    await writeTextFile(todayPath, JSON.stringify(backup, null, 2));
    created = true;
  }

  // Rotation: keep only the most recent N backups.
  const retentionCount = await getRetentionCount();
  const all = await listAutoBackups();
  const toDelete = all.slice(retentionCount);
  for (const entry of toDelete) {
    await remove(await join(dir, entry.filename)).catch(() => {}); // best-effort cleanup
  }

  return { created };
}

/** Restores from a specific automatic backup file. Caller should confirm with the user first. */
export async function restoreFromAutoBackup(filename: string): Promise<{ restoredTables: string[] }> {
  const path = await join(await backupsDir(), filename);
  const raw = await readTextFile(path);
  const backup: BackupFile = JSON.parse(raw);
  return applyBackupObject(backup);
}

export async function deleteAutoBackup(filename: string): Promise<void> {
  await remove(await join(await backupsDir(), filename));
}
