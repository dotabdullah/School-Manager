import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  Wallet,
  Receipt,
  LineChart,
  ClipboardCheck,
  BadgeDollarSign,
  Award,
  KeyRound,
  Database,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  ShieldCheck,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./theme/ThemeProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import { FeatureKey } from "./license/licenseFormat";
import { checkLicense, LicenseCheckResult } from "./license/license";
import { getTrialStatus, TRIAL_LENGTH_DAYS } from "./license/trial";
import { runAutoBackupIfNeeded } from "./lib/autoBackup";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Teachers from "./pages/Teachers";
import Classes from "./pages/Classes";
import Fees from "./pages/Fees";
import Expenses from "./pages/Expenses";
import Finance from "./pages/Finance";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Exams from "./pages/Exams";
import Settings from "./pages/Settings";
import StationLicensing from "./pages/StationLicensing";

type Tab = "dashboard" | "students" | "teachers" | "classes" | "fees" | "expenses" | "finance" | "attendance" | "payroll" | "exams" | "licensing" | "backup";

type AccessState =
  | { mode: "checking" }
  | { mode: "licensed"; license: Extract<LicenseCheckResult, { valid: true }> }
  | { mode: "trial"; dayNumber: number; daysLeft: number }
  | { mode: "locked" };

const NAV_ITEMS: { tab: Tab; icon: React.ReactNode; label: string; feature?: FeatureKey }[] = [
  { tab: "dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: "Dashboard" },
  { tab: "students", icon: <Users className="w-4 h-4" />, label: "Students", feature: "students" },
  { tab: "teachers", icon: <GraduationCap className="w-4 h-4" />, label: "Teachers", feature: "teachers" },
  { tab: "classes", icon: <School className="w-4 h-4" />, label: "Classes", feature: "classes" },
  { tab: "fees", icon: <Wallet className="w-4 h-4" />, label: "Fee Ledger", feature: "fees" },
  { tab: "expenses", icon: <Receipt className="w-4 h-4" />, label: "Expenses", feature: "expenses" },
  { tab: "finance", icon: <LineChart className="w-4 h-4" />, label: "Finance", feature: "finance" },
  { tab: "attendance", icon: <ClipboardCheck className="w-4 h-4" />, label: "Attendance", feature: "attendance" },
  { tab: "payroll", icon: <BadgeDollarSign className="w-4 h-4" />, label: "Payroll", feature: "payroll" },
  { tab: "exams", icon: <Award className="w-4 h-4" />, label: "Exams & Results", feature: "exams" },
  { tab: "licensing", icon: <KeyRound className="w-4 h-4" />, label: "Station Licensing" },
  { tab: "backup", icon: <Database className="w-4 h-4" />, label: "Backup & Data" },
];

export default function App() {
  // Catches the easy mistake of opening http://localhost:1420 in a normal browser tab
  // instead of running the actual Tauri window — nothing native (fs/sql/hardware id)
  // works there, so fail fast with a clear message instead of hanging forever.
  if (!isTauri()) {
    return <NotRunningInTauri />;
  }

  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

function NotRunningInTauri() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#080B0F] text-[#E9EEF2] p-6">
      <div className="max-w-md text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-400" />
        <h1 className="font-semibold text-lg">This isn't a website — it's a desktop app</h1>
        <p className="text-sm text-[#8D98A3]">
          You've opened the dev server URL directly in a browser tab. That page has no access to
          your database, files, or hardware ID. Close this tab and run{" "}
          <code className="text-[#A3E635]">npm run tauri:dev:creator</code> (or{" "}
          <code className="text-[#A3E635]">tauri:dev:school</code>) — that launches the actual
          native app window this project needs.
        </p>
      </div>
    </div>
  );
}

function Shell() {
  const [access, setAccess] = useState<AccessState>({ mode: "checking" });
  const [tab, setTab] = useState<Tab>("dashboard");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  async function refreshAccess() {
    const license = await checkLicense();
    if (license.valid) {
      setAccess({ mode: "licensed", license });
      return;
    }
    const trial = await getTrialStatus();
    if (!trial.expired) {
      setAccess({ mode: "trial", dayNumber: trial.dayNumber, daysLeft: trial.daysLeft });
    } else {
      setAccess({ mode: "locked" });
    }
  }

  useEffect(() => {
    refreshAccess();
    runAutoBackupIfNeeded().catch(() => {}); // best-effort — never block startup on this
  }, []);

  if (access.mode === "checking") {
    return <div className="h-screen flex items-center justify-center text-ink-muted">Checking license…</div>;
  }

  // Locked (trial over, no valid license) — only the licensing screen is reachable.
  if (access.mode === "locked") {
    return (
      <div className="h-screen flex flex-col bg-base text-ink">
        <StatusBanner access={access} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <StationLicensing license={{ valid: false, reason: "missing" }} onActivated={refreshAccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-base text-ink overflow-hidden">
      <Sidebar tab={tab} setTab={setTab} collapsed={collapsed} setCollapsed={setCollapsed} access={access} />

      <div className="flex-1 flex flex-col min-w-0">
        <StatusBanner access={access} />
        <TopBar access={access} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ErrorBoundary key={tab}>
            {tab === "dashboard" && <Dashboard access={access} />}
            {tab === "students" && (isFeatureEnabled(access, "students") ? <Students /> : <FeatureLocked label="Students" />)}
            {tab === "teachers" && (isFeatureEnabled(access, "teachers") ? <Teachers /> : <FeatureLocked label="Teachers" />)}
            {tab === "classes" && (isFeatureEnabled(access, "classes") ? <Classes /> : <FeatureLocked label="Classes" />)}
            {tab === "fees" && (isFeatureEnabled(access, "fees") ? <Fees /> : <FeatureLocked label="Fee Ledger" />)}
            {tab === "expenses" && (isFeatureEnabled(access, "expenses") ? <Expenses /> : <FeatureLocked label="Expenses" />)}
            {tab === "finance" && (isFeatureEnabled(access, "finance") ? <Finance /> : <FeatureLocked label="Finance" />)}
            {tab === "attendance" && (isFeatureEnabled(access, "attendance") ? <Attendance /> : <FeatureLocked label="Attendance" />)}
            {tab === "payroll" && (isFeatureEnabled(access, "payroll") ? <Payroll /> : <FeatureLocked label="Payroll" />)}
            {tab === "exams" && (isFeatureEnabled(access, "exams") ? <Exams /> : <FeatureLocked label="Exams & Results" />)}
            {tab === "licensing" && (
              <StationLicensing
                license={access.mode === "licensed" ? access.license : { valid: false, reason: "missing" }}
                onActivated={refreshAccess}
              />
            )}
            {tab === "backup" && <Settings />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function isFeatureEnabled(access: AccessState, feature: FeatureKey): boolean {
  if (access.mode !== "licensed") return true; // trial = everything unlocked
  return access.license.payload.features.includes(feature);
}

function FeatureLocked({ label }: { label: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-16 space-y-2">
      <div className="text-sm font-medium">{label} isn't included in this license</div>
      <p className="text-sm text-ink-muted">
        Contact your software provider if you'd like this module added — they can issue an updated
        activation key without affecting your existing data.
      </p>
    </div>
  );
}

function Sidebar({
  tab,
  setTab,
  collapsed,
  setCollapsed,
  access,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  collapsed: boolean;
  setCollapsed: (fn: (c: boolean) => boolean) => void;
  access: AccessState;
}) {
  // Trial mode unlocks every module (it's a sales trial). Once a real license is active,
  // only the modules included in that license's `features` list are shown.
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.feature) return true;
    if (access.mode !== "licensed") return true;
    return access.license.payload.features.includes(item.feature);
  });

  return (
    <aside
      className={`shrink-0 h-full border-r border-border bg-surface/60 flex flex-col transition-[width] duration-150 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className={`flex items-center gap-2.5 px-3 py-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center font-display font-bold text-black shrink-0">
          SM
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display font-semibold leading-tight text-sm truncate">School Manager</div>
            <div className="text-xs text-ink-muted leading-tight truncate">Frontdesk SaaS</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {visibleItems.map((item) => (
          <button
            key={item.tab}
            onClick={() => setTab(item.tab)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition ${
              collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
            } ${tab === item.tab ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-surface hover:text-ink"}`}
          >
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className={`m-2 flex items-center gap-2 rounded-lg border border-border text-ink-muted hover:bg-surface hover:text-ink transition text-xs ${
          collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
        }`}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}

function StatusBanner({ access }: { access: AccessState }) {
  if (access.mode === "trial") {
    return (
      <div className="flex items-center justify-between bg-warn/90 text-black px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium">
        <span>
          7-Day Free Trial Active: Day {access.dayNumber} of {TRIAL_LENGTH_DAYS} ({access.daysLeft} day
          {access.daysLeft === 1 ? "" : "s"} left). All features unlocked!
        </span>
      </div>
    );
  }
  if (access.mode === "locked") {
    return (
      <div className="bg-danger/90 text-white px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium">
        Your trial has ended. Activate a license below to continue using School Manager.
      </div>
    );
  }
  return null;
}

function TopBar({ access }: { access: AccessState }) {
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();

  return (
    <header className="flex items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 border-b border-border shrink-0">
      {access.mode === "licensed" && (
        <span className="hidden md:flex items-center gap-1.5 text-xs rounded-full bg-accent-soft text-accent px-3 py-1.5 font-medium whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5" />
          {access.license.payload.school} · {access.license.daysRemaining}d left
        </span>
      )}

      <span className="hidden sm:flex items-center gap-1.5 text-xs rounded-full border border-border px-3 py-1.5 text-ink-muted whitespace-nowrap">
        {online ? <Wifi className="w-3.5 h-3.5 text-accent" /> : <WifiOff className="w-3.5 h-3.5" />}
        {online ? "Internet Active" : "Offline"}
      </span>

      <button
        onClick={toggle}
        className="w-9 h-9 shrink-0 rounded-lg border border-border flex items-center justify-center hover:bg-surface transition"
        title="Toggle theme"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </header>
  );
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
