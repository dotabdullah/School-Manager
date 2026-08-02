import { useEffect, useState } from "react";
import { DatabaseBackup, FileDown, FileSpreadsheet, ShieldCheck, Building2, MessageCircle, History, Trash2, RotateCcw, CheckCircle2 } from "lucide-react";
import { exportBackup, importBackup } from "../lib/backup";
import { exportAllTablesAsCsv } from "../lib/importExport";
import { checkLicense, LicenseCheckResult } from "../license/license";
import { getSchoolProfile, setSchoolProfile, SchoolProfile } from "../db/db";
import { DEFAULT_REMINDER_TEMPLATE } from "../lib/whatsapp";
import {
  listAutoBackups,
  restoreFromAutoBackup,
  deleteAutoBackup,
  getRetentionCount,
  setRetentionCount,
  AutoBackupEntry,
} from "../lib/autoBackup";

export default function Settings() {
  const [status, setStatus] = useState("");
  const [license, setLicense] = useState<LicenseCheckResult | null>(null);
  const [profile, setProfile] = useState<SchoolProfile>({ name: "", address: "", phone: "", feeReminderTemplate: "" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>([]);
  const [retentionCount, setRetentionCountState] = useState(10);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  async function refreshAutoBackups() {
    setAutoBackups(await listAutoBackups());
    setRetentionCountState(await getRetentionCount());
  }

  useEffect(() => {
    checkLicense().then(setLicense);
    getSchoolProfile().then(setProfile);
    refreshAutoBackups();
  }, []);

  async function handleSaveProfile() {
    await setSchoolProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function handleExportBackup() {
    setStatus("Creating backup…");
    await exportBackup();
    setStatus("Backup saved.");
  }

  async function handleImportBackup() {
    setStatus("Restoring…");
    const result = await importBackup();
    setStatus(
      result.restoredTables.length === 0
        ? "Restore cancelled."
        : `Restored: ${result.restoredTables.join(", ")}. Reloading…`
    );
    if (result.restoredTables.length > 0) setTimeout(() => window.location.reload(), 1200);
  }

  async function handleExportAllCsv() {
    setStatus("Exporting all tables as CSV…");
    await exportAllTablesAsCsv();
    setStatus("All tables exported.");
  }

  async function handleRestoreAuto(filename: string) {
    setStatus("Restoring from automatic backup…");
    const result = await restoreFromAutoBackup(filename);
    setConfirmRestore(null);
    setStatus(`Restored: ${result.restoredTables.join(", ")}. Reloading…`);
    setTimeout(() => window.location.reload(), 1200);
  }

  async function handleDeleteAuto(filename: string) {
    await deleteAutoBackup(filename);
    refreshAutoBackups();
  }

  async function handleRetentionChange(value: string) {
    const n = parseInt(value, 10);
    if (!n || n < 1) return;
    await setRetentionCount(n);
    refreshAutoBackups();
  }

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Backup &amp; Data</h2>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-accent" />
          <h3 className="font-display font-semibold">School Profile</h3>
        </div>
        <p className="text-sm text-ink-muted">Used to brand printed fee receipts.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className="input" placeholder="School Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <input className="input" placeholder="Address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <input className="input" placeholder="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </div>
        <button onClick={handleSaveProfile} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition">
          {profileSaved ? "Saved ✓" : "Save Profile"}
        </button>

        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">WhatsApp Fee Reminder Message</span>
          </div>
          <p className="text-xs text-ink-muted">
            Placeholders: <code>{"{student}"}</code>, <code>{"{amount}"}</code>, <code>{"{month}"}</code>, <code>{"{school}"}</code>
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder={DEFAULT_REMINDER_TEMPLATE}
            value={profile.feeReminderTemplate}
            onChange={(e) => setProfile({ ...profile, feeReminderTemplate: e.target.value })}
          />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-accent" />
          <h3 className="font-display font-semibold">Full Backup (JSON)</h3>
        </div>
        <p className="text-sm text-ink-muted">
          One file containing every table's data. Use this to move your whole school's data to another
          computer, or as a manual safety backup.
        </p>
        <div className="flex gap-2">
          <button onClick={handleExportBackup} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition">
            Export Full Backup
          </button>
          <button onClick={handleImportBackup} className="rounded-lg border border-danger text-danger px-4 py-2 text-sm hover:bg-danger/10 transition">
            Restore From Backup
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold">Automatic Backups</h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Keep last
            <input
              type="number"
              min={1}
              className="input w-16 py-1"
              value={retentionCount}
              onChange={(e) => handleRetentionChange(e.target.value)}
            />
            backups
          </label>
        </div>
        <p className="text-sm text-ink-muted">
          A backup is created automatically once per day, the first time you open the app that day — no
          action needed. The oldest backups beyond your retention count are cleaned up automatically.
        </p>

        {autoBackups.length === 0 ? (
          <p className="text-sm text-ink-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-accent" /> No automatic backups yet — one will be created the next time you open the app.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-left font-medium px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {autoBackups.map((b) => (
                    <tr key={b.filename}>
                      <td className="px-3 py-2">{b.date}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setConfirmRestore(b.filename)}
                            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                          <button
                            onClick={() => handleDeleteAuto(b.filename)}
                            className="inline-flex items-center gap-1 text-xs text-danger hover:opacity-80"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-accent" />
          <h3 className="font-display font-semibold">Export All Data as CSV</h3>
        </div>
        <p className="text-sm text-ink-muted">
          Saves every table as its own .csv file — handy for opening in Excel. Not used for restoring.
        </p>
        <button onClick={handleExportAllCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-raised transition">
          <FileDown className="w-4 h-4" /> Export All as CSV
        </button>
      </div>

      {status && <p className="text-sm text-ink-muted">{status}</p>}

      <div className="card space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h3 className="font-display font-semibold">License</h3>
        </div>
        {license?.valid ? (
          <p className="text-sm text-ink-muted">
            School: <span className="text-ink font-medium">{license.payload.school}</span> · Plan:{" "}
            {license.payload.plan} · Expires {license.payload.expiryDate} ({license.daysRemaining} days left)
          </p>
        ) : (
          <p className="text-sm text-ink-muted">No active license.</p>
        )}
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-3">
            <h3 className="font-medium text-sm">Restore backup from {confirmRestore.replace("backup-", "").replace(".json", "")}?</h3>
            <p className="text-sm text-danger">This will REPLACE all current data. This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestoreAuto(confirmRestore)}
                className="flex-1 rounded-lg bg-danger text-white font-medium px-4 py-2 text-sm hover:opacity-90 transition"
              >
                Yes, Restore
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-raised transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
