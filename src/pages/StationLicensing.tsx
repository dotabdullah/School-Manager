import { useEffect, useState, lazy, Suspense } from "react";
import { Cpu, Monitor, KeyRound, Building2, HelpCircle, ShieldCheck, Loader2, Layers } from "lucide-react";
import { getHardwareId } from "../license/hardware";
import { activateWithKey, LicenseCheckResult } from "../license/license";
import { STATION_PLAN_LABELS } from "../license/licenseFormat";

// Dynamically imported so its code (and any signing logic it pulls in) is only
// ever fetched in the Creator build — never bundled into the school .exe.
const CreatorAdminPanel = lazy(() => import("./CreatorAdminPanel"));
const IS_CREATOR_BUILD = import.meta.env.VITE_APP_MODE === "creator";

export default function StationLicensing({
  license,
  onActivated,
}: {
  license: LicenseCheckResult;
  onActivated: () => void;
}) {
  const [hardwareId, setHardwareId] = useState("…");
  const [activationKey, setActivationKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getHardwareId().then(setHardwareId);
  }, []);

  async function handleActivate() {
    setError("");
    setBusy(true);
    try {
      const result = await activateWithKey(activationKey);
      if (!result.valid) {
        setError(activationErrorMessage(result.reason));
      } else {
        onActivated();
      }
    } catch {
      setError("That activation key doesn't look right — please check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Station Licensing</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Station Lock & License Status */}
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-accent" />
              <h3 className="font-display font-semibold text-lg">Station Lock &amp; License Status</h3>
            </div>
            <StatusBadge license={license} />
          </div>
          <p className="text-sm text-ink-muted -mt-3">
            Verify node-lock authentication binding for this terminal
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoBox icon={<Cpu className="w-4 h-4" />} label="Device Hardware ID" value={hardwareId} mono />
            <InfoBox
              icon={<Monitor className="w-4 h-4" />}
              label="Current Lock Target"
              value={license.valid ? license.payload.school : "Not activated"}
            />
            <InfoBox
              icon={<Layers className="w-4 h-4" />}
              label="Station Plan"
              value={license.valid ? STATION_PLAN_LABELS[license.payload.stationPlan] : "—"}
            />
          </div>

          <Field label="Activation Key">
            <input
              className="input font-mono"
              placeholder="SCH-XXXXXX-XXXXXX-..."
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-muted -mt-2">
            The school name and expiry are embedded in the key itself — nothing else to fill in here.
          </p>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={handleActivate}
            disabled={busy || !activationKey}
            className="w-full rounded-xl bg-accent text-black font-semibold py-3 flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Activate &amp; Lock Station
          </button>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-accent" />
            <h3 className="font-display font-semibold text-lg">How Does PC Node Locking Work?</h3>
          </div>
          <ol className="text-sm text-ink-muted space-y-3 list-decimal list-inside">
            <li>
              <strong className="text-ink">Hardware fingerprinting:</strong> on first launch, the app reads a
              stable identifier from this PC's hardware/OS install.
            </li>
            <li>
              <strong className="text-ink">Offline verification:</strong> the activation key we send you is
              cryptographically signed and checked entirely on this device — no internet required day to day.
            </li>
            <li>
              <strong className="text-ink">Anti-copy lock:</strong> if the app or database is copied to another
              computer, the hardware ID won't match and access locks automatically.
            </li>
            <li>
              <strong className="text-ink">Multi-station plans:</strong> a 3-Station license authorizes up to
              three specific PCs (e.g. front desk + accounts office) using the same activation key — each PC's
              data stays separate and local to that machine, since everything works fully offline.
            </li>
          </ol>
          <div className="rounded-xl bg-accent-soft border border-accent/20 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium mb-1">
              <ShieldCheck className="w-4 h-4 text-accent" /> Renewing your license
            </div>
            <p className="text-ink-muted">
              Send us this Hardware ID when your yearly plan is due for renewal — we'll generate a new
              activation key for this same device.
            </p>
          </div>
        </div>
      </div>

      {IS_CREATOR_BUILD && (
        <Suspense fallback={null}>
          <CreatorAdminPanel />
        </Suspense>
      )}
    </div>
  );
}

function StatusBadge({ license }: { license: LicenseCheckResult }) {
  if (license.valid) {
    return (
      <span className="text-xs font-medium rounded-full bg-accent-soft text-accent px-3 py-1">
        {license.daysRemaining} day{license.daysRemaining === 1 ? "" : "s"} left
      </span>
    );
  }
  return (
    <span className="text-xs font-medium rounded-full bg-warn/15 text-warn px-3 py-1">Not Activated</span>
  );
}

function InfoBox({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-raised border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-1">
        {icon} {label}
      </div>
      <div className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
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

function activationErrorMessage(reason: string): string {
  switch (reason) {
    case "invalid_signature":
      return "This activation key isn't valid. Please double check it or contact support.";
    case "hardware_mismatch":
      return "This key was issued for a different PC. Send us THIS device's Hardware ID to get a new one.";
    case "expired":
      return "This activation key has expired. Contact us to renew.";
    default:
      return "Couldn't activate — please check the key and try again.";
  }
}
