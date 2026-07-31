import { useEffect, useState } from "react";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { KeyRound, Copy, Check, ShieldAlert, History } from "lucide-react";
import {
  encodeActivationKey,
  LicensePayload,
  FEATURE_KEYS,
  FEATURE_LABELS,
  FeatureKey,
  STATION_PLANS,
  STATION_PLAN_LABELS,
  StationPlan,
} from "../license/licenseFormat";
import { getLicenseLog, logIssuedLicense, LicenseLogEntry } from "../license/licenseLog";

const STATION_COUNTS: Record<StationPlan, number> = { "1": 1, "3": 3, unlimited: 0 };

/**
 * This panel signs new licenses. It intentionally never has the private key
 * hardcoded — it loads `license-signing-key.PRIVATE.json` (created by
 * `npm run generate-keypair`) from disk each time, so the key never ends up
 * baked into any JS bundle, even this Creator-only one.
 */
export default function CreatorAdminPanel() {
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [secretKeyB64, setSecretKeyB64] = useState<string | null>(null);

  const [school, setSchool] = useState("");
  const [stationPlan, setStationPlan] = useState<StationPlan>("1");
  const [hardwareIds, setHardwareIds] = useState<string[]>([""]);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry());
  const [features, setFeatures] = useState<FeatureKey[]>([...FEATURE_KEYS]);
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState<LicenseLogEntry[]>([]);

  useEffect(() => {
    getLicenseLog().then(setLog);
  }, []);

  function handlePlanChange(plan: StationPlan) {
    setStationPlan(plan);
    const count = STATION_COUNTS[plan];
    if (count > 0) {
      setHardwareIds((prev) => {
        const next = [...prev];
        while (next.length < count) next.push("");
        return next.slice(0, count);
      });
    }
  }

  function updateHardwareId(index: number, value: string) {
    setHardwareIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  }

  async function loadPrivateKey() {
    setError("");
    const path = await open({
      multiple: false,
      filters: [{ name: "Private Key", extensions: ["json"] }],
    });
    if (!path || Array.isArray(path)) return;
    try {
      const contents = JSON.parse(await readTextFile(path));
      setSecretKeyB64(contents.secretKey);
      setKeyLoaded(true);
    } catch {
      setError("Couldn't read that file — is it license-signing-key.PRIVATE.json?");
    }
  }

  function generate() {
    setError("");
    if (!secretKeyB64) return setError("Load your private key file first.");
    if (!school.trim()) return setError("Enter the school name.");

    const cleanedIds = hardwareIds.map((id) => id.trim()).filter(Boolean);
    if (stationPlan !== "unlimited" && cleanedIds.length === 0) {
      return setError("Enter at least one hardware ID (one per station) the school sent you.");
    }
    if (stationPlan !== "unlimited" && cleanedIds.length < STATION_COUNTS[stationPlan]) {
      return setError(
        `This is a ${STATION_PLAN_LABELS[stationPlan]} license — enter a hardware ID for all ${STATION_COUNTS[stationPlan]} station(s), or switch plans.`
      );
    }

    const payload: LicensePayload = {
      school: school.trim(),
      licenseId: crypto.randomUUID(),
      hardwareIds: stationPlan === "unlimited" ? [] : cleanedIds,
      stationPlan,
      issuedAt: new Date().toISOString(),
      expiryDate,
      plan: "yearly",
      features,
    };

    const secretKey = naclUtil.decodeBase64(secretKeyB64);
    const message = naclUtil.decodeUTF8(JSON.stringify(payload));
    const signature = nacl.sign.detached(message, secretKey);

    const key = encodeActivationKey({ payload, signature: naclUtil.encodeBase64(signature) });
    setGeneratedKey(key);
    setCopied(false);

    const entry: LicenseLogEntry = {
      licenseId: payload.licenseId,
      school: payload.school,
      hardwareIds: payload.hardwareIds,
      stationPlan: payload.stationPlan,
      issuedAt: payload.issuedAt,
      expiryDate: payload.expiryDate,
      plan: payload.plan,
      features: payload.features,
    };
    logIssuedLicense(entry).then(() => getLicenseLog().then(setLog));
  }

  function toggleFeature(key: FeatureKey) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  function copy() {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-accent" />
        <h3 className="font-display font-semibold text-lg">Creator Licensing Admin Panel</h3>
      </div>
      <p className="text-sm text-ink-muted">
        Generate a signed, hardware-locked activation key for a school after they've paid.
        This panel only exists in your private Creator build — it never ships to schools.
      </p>

      {!keyLoaded ? (
        <button
          onClick={loadPrivateKey}
          className="rounded-lg bg-accent text-black font-medium px-4 py-2 hover:opacity-90 transition"
        >
          Load Signing Key File
        </button>
      ) : (
        <div className="text-sm text-accent flex items-center gap-2">
          <Check className="w-4 h-4" /> Signing key loaded
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="School Name">
          <input
            className="input"
            placeholder="e.g. Al-Noor Public School"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
        </Field>
        <Field label="Expiry Date">
          <input type="date" className="input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="text-sm text-ink-muted mb-2">Station Plan</div>
        <div className="flex flex-wrap gap-2">
          {STATION_PLANS.map((plan) => (
            <button
              key={plan}
              onClick={() => handlePlanChange(plan)}
              className={`text-xs rounded-full border px-3 py-1.5 transition ${
                stationPlan === plan ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted hover:bg-surface-raised"
              }`}
            >
              {STATION_PLAN_LABELS[plan]}
            </button>
          ))}
        </div>
      </div>

      {stationPlan === "unlimited" ? (
        <p className="text-xs text-ink-muted rounded-lg bg-surface-raised border border-border p-3">
          Unlimited-station licenses skip the hardware-lock check entirely — this key will
          activate on any PC it's pasted into. No hardware IDs needed.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-ink-muted">
            Hardware ID{STATION_COUNTS[stationPlan] > 1 ? "s" : ""} (one per station — ask the school
            to send you the Device Hardware ID shown on each PC's Station Licensing screen)
          </div>
          {hardwareIds.map((id, i) => (
            <input
              key={i}
              className="input font-mono"
              placeholder={`SCH-HW-XXXXXX (Station ${i + 1})`}
              value={id}
              onChange={(e) => updateHardwareId(i, e.target.value)}
            />
          ))}
        </div>
      )}

      <div>
        <div className="text-sm text-ink-muted mb-2">Enabled Modules for This License</div>
        <div className="flex flex-wrap gap-2">
          {FEATURE_KEYS.map((key) => (
            <label
              key={key}
              className={`inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 cursor-pointer transition ${
                features.includes(key) ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted"
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={features.includes(key)}
                onChange={() => toggleFeature(key)}
              />
              {FEATURE_LABELS[key]}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-2">
          Dashboard, Station Licensing, and Backup &amp; Data are always available. To change a
          school's enabled modules or station count later, just generate and send them a new key.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <ShieldAlert className="w-4 h-4" /> {error}
        </div>
      )}

      <button
        onClick={generate}
        className="rounded-lg bg-accent text-black font-semibold px-5 py-2.5 hover:opacity-90 transition"
      >
        Generate Activation Key
      </button>

      {generatedKey && (
        <div className="rounded-xl bg-surface-raised border border-border p-4 space-y-2">
          <div className="text-xs text-ink-muted uppercase tracking-wide">Activation Key</div>
          <div className="font-mono text-sm break-all">{generatedKey}</div>
          <p className="text-xs text-ink-muted">
            This same key activates on every station listed above — send it once, each PC pastes the identical key.
          </p>
          <button
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 py-1.5 hover:bg-surface transition"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy Key"}
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <div className="flex items-center gap-2 mb-3 mt-4">
          <History className="w-4 h-4 text-ink-muted" />
          <h4 className="font-medium text-sm">Issued Licenses ({log.length})</h4>
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing issued yet — generated keys will show up here for future reference.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-3 py-2">School</th>
                  <th className="text-left font-medium px-3 py-2">Plan</th>
                  <th className="text-left font-medium px-3 py-2">Hardware IDs</th>
                  <th className="text-left font-medium px-3 py-2">Issued</th>
                  <th className="text-left font-medium px-3 py-2">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {log.map((entry) => (
                  <tr key={entry.licenseId}>
                    <td className="px-3 py-2 font-medium">{entry.school}</td>
                    <td className="px-3 py-2">{STATION_PLAN_LABELS[entry.stationPlan as StationPlan] ?? entry.stationPlan}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {entry.hardwareIds?.length ? entry.hardwareIds.join(", ") : "— (unlimited)"}
                    </td>
                    <td className="px-3 py-2">{entry.issuedAt.slice(0, 10)}</td>
                    <td className="px-3 py-2">{entry.expiryDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function defaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
