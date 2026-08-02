import { save, open, ask } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getStore, replaceAll, TABLES, AppData } from "../db/db";

export const BACKUP_TABLES = TABLES;

export interface BackupFile {
  meta: {
    app: "school-manager";
    version: 1;
    exportedAt: string; // ISO timestamp
  };
  tables: Record<string, any[]>;
  extras: {
    schoolProfile: AppData["schoolProfile"];
    expenseCategories: string[];
  };
}

/** Builds the backup object from the live store — no file I/O. Shared by manual export and automatic backups. */
export async function buildBackupObject(): Promise<BackupFile> {
  const store = await getStore();
  return {
    meta: {
      app: "school-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
    },
    tables: Object.fromEntries(TABLES.map((t) => [t, store[t]])),
    extras: {
      schoolProfile: store.schoolProfile,
      expenseCategories: store.expenseCategories,
    },
  };
}

/**
 * Replaces all current data with the contents of a backup object — no file I/O,
 * no confirmation prompt (callers are responsible for confirming with the user first).
 */
export async function applyBackupObject(backup: BackupFile): Promise<{ restoredTables: string[] }> {
  if (backup?.meta?.app !== "school-manager") {
    throw new Error("This doesn't look like a valid school-manager backup file.");
  }

  const restoredTables: string[] = [];
  const nextData: Partial<AppData> = {};

  for (const table of TABLES) {
    const rows = backup.tables[table];
    if (!rows) continue;
    (nextData as any)[table] = rows;
    restoredTables.push(table);
  }

  if (backup.extras?.schoolProfile) nextData.schoolProfile = backup.extras.schoolProfile;
  if (backup.extras?.expenseCategories) nextData.expenseCategories = backup.extras.expenseCategories;

  const nextIds: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = (nextData as any)[table] ?? [];
    const maxId = rows.reduce((max: number, r: any) => Math.max(max, r.id ?? 0), 0);
    nextIds[table] = maxId + 1;
  }
  nextData.nextIds = nextIds;

  await replaceAll(nextData);
  return { restoredTables };
}

/** Exports every table's data (plus school profile / expense categories) into one readable .json file, chosen by the user. */
export async function exportBackup() {
  const backup = await buildBackupObject();
  const path = await save({
    defaultPath: `school-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path) return;
  await writeTextFile(path, JSON.stringify(backup, null, 2));
}

/**
 * Restores a full backup chosen via file picker, REPLACING all current data.
 * Always confirms with the user before applying — this is destructive.
 */
export async function importBackup(): Promise<{ restoredTables: string[] }> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path || Array.isArray(path)) return { restoredTables: [] };

  const raw = await readTextFile(path);
  const backup: BackupFile = JSON.parse(raw);

  if (backup?.meta?.app !== "school-manager") {
    throw new Error("This doesn't look like a valid school-manager backup file.");
  }

  const confirmed = await ask(
    "Restoring this backup will REPLACE all current data. This cannot be undone. Continue?",
    { title: "Confirm Restore", kind: "warning" }
  );
  if (!confirmed) return { restoredTables: [] };

  return applyBackupObject(backup);
}
