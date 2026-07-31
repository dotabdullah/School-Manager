import * as XLSX from "xlsx";
import Papa from "papaparse";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile, writeFile, readFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { insertRow, getAll, TableName } from "../db/db";
import { BACKUP_TABLES } from "./backup";

/** Export any array of row objects to a CSV file, letting the user pick where to save it. */
export async function exportToCsv(rows: Record<string, any>[], suggestedName: string) {
  if (rows.length === 0) throw new Error("Nothing to export.");
  const csv = Papa.unparse(rows);
  const path = await save({
    defaultPath: `${suggestedName}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return; // user cancelled
  await writeTextFile(path, csv);
}

/** Export any array of row objects to an Excel (.xlsx) file. */
export async function exportToExcel(rows: Record<string, any>[], suggestedName: string) {
  if (rows.length === 0) throw new Error("Nothing to export.");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

  const path = await save({
    defaultPath: `${suggestedName}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(buffer));
}

/**
 * Exports EVERY table as its own plain CSV file into a folder the user picks.
 * This is for "give me all my data as CSV" (e.g. to open in Excel) — it is NOT
 * restorable the way the JSON backup is; use exportBackup()/importBackup() for that.
 */
export async function exportAllTablesAsCsv() {
  const folder = await open({ directory: true, multiple: false });
  if (!folder || Array.isArray(folder)) return;

  for (const table of BACKUP_TABLES) {
    const rows = await getAll(table);
    if (rows.length === 0) continue;
    const csv = Papa.unparse(rows);
    await writeTextFile(await join(folder, `${table}.csv`), csv);
  }
}

/**
 * Lets the user pick a CSV or Excel file, parses it into row objects,
 * and inserts each row into the given table.
 * `columnMap` maps spreadsheet header names -> DB column names (case-insensitive match if omitted).
 */
export async function importFromFile(
  table: TableName,
  columnMap?: Record<string, string>
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Spreadsheet", extensions: ["csv", "xlsx", "xls"] }],
  });
  if (!path || Array.isArray(path)) return { inserted: 0, skipped: 0, errors: [] };

  let rows: Record<string, any>[] = [];

  if (path.toLowerCase().endsWith(".csv")) {
    const text = await readTextFile(path);
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    rows = parsed.data as Record<string, any>[];
  } else {
    const bytes = await readFile(path);
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
  }

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rawRow of rows) {
    try {
      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const dbKey = columnMap?.[key] ?? key.toLowerCase().trim().replace(/\s+/g, "_");
        mapped[dbKey] = value;
      }
      await insertRow(table, mapped);
      inserted++;
    } catch (e) {
      skipped++;
      errors.push(String(e));
    }
  }

  return { inserted, skipped, errors };
}
