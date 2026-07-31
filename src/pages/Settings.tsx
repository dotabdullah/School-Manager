import { useEffect, useState } from "react";
import { DatabaseBackup, FileDown, FileSpreadsheet, ShieldCheck, Building2 } from "lucide-react";
import { exportBackup, importBackup } from "../lib/backup";
import { exportAllTablesAsCsv } from "../lib/importExport";
import { checkLicense, LicenseCheckResult } from "../license/license";
import { getSchoolProfile, setSchoolProfile, SchoolProfile } from "../db/db";

export default function Settings() {
  const [status, setStatus] = useState("");
  const [license, setLicense] = useState<LicenseCheckResult | null>(null);
  const [profile, setProfile] = useState<SchoolProfile>({ name: "", address: "", phone: "" });
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    checkLicense().then(setLicense);
    getSchoolProfile().then(setProfile);
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
  }

  async function handleExportAllCsv() {
    setStatus("Exporting all tables as CSV…");
    await exportAllTablesAsCsv();
    setStatus("All tables exported.");
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
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-accent" />
          <h3 className="font-display font-semibold">Full Backup (JSON)</h3>
        </div>
        <p className="text-sm text-ink-muted">
          One file containing every table's data. Use this to move your whole school's data to another
          computer, or as a safety backup.
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
    </div>
  );
}
