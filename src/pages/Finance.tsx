import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Wallet, TrendingDown, Receipt, Scale, Download, Users2, AlertCircle, MessageCircle } from "lucide-react";
import { getStore, getSchoolProfile, Salary, Student, SchoolProfile } from "../db/db";
import { exportToCsv } from "../lib/importExport";
import WhatsAppReminderModal from "../components/WhatsAppReminderModal";

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function monthLabelLong(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function currentMonthKey() {
  return lastNMonthKeys(1)[0];
}

interface ClassReportRow {
  className: string;
  totalNet: number;
  totalPaid: number;
  outstanding: number;
}

interface SalaryRow extends Salary {
  teacher_name: string;
}

export default function Finance() {
  const [collectedThisMonth, setCollectedThisMonth] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [expensesThisMonth, setExpensesThisMonth] = useState(0);
  const [trend, setTrend] = useState<{ month: string; Income: number; Expenses: number }[]>([]);
  const [classReport, setClassReport] = useState<ClassReportRow[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);
  const [feeDefaulters, setFeeDefaulters] = useState<{ student: Student; owed: number }[]>([]);
  const [school, setSchool] = useState<SchoolProfile>({ name: "", address: "", phone: "", feeReminderTemplate: "" });
  const [reminderFor, setReminderFor] = useState<{ student: Student; owed: number } | null>(null);

  useEffect(() => {
    (async () => {
      const store = await getStore();
      setSchool(await getSchoolProfile());
      const thisMonthKey = monthKey(new Date().toISOString());

      const collected = store.fees
        .filter((f) => f.paid_date && monthKey(f.paid_date) === thisMonthKey)
        .reduce((sum, f) => sum + f.paid_amount, 0);
      setCollectedThisMonth(collected);

      const totalOutstanding = store.fees.reduce((sum, f) => sum + Math.max(0, f.net_amount - f.paid_amount), 0);
      setOutstanding(totalOutstanding);

      const expThisMonth = store.expenses.filter((e) => monthKey(e.date) === thisMonthKey).reduce((sum, e) => sum + e.amount, 0);
      setExpensesThisMonth(expThisMonth);

      const months = lastNMonthKeys(6);
      const trendData = months.map((key) => {
        const income = store.fees.filter((f) => f.paid_date && monthKey(f.paid_date) === key).reduce((sum, f) => sum + f.paid_amount, 0);
        const expense = store.expenses.filter((e) => monthKey(e.date) === key).reduce((sum, e) => sum + e.amount, 0);
        return { month: monthLabel(key), Income: income, Expenses: expense };
      });
      setTrend(trendData);

      const studentClassById = new Map(store.students.map((s) => [s.id, s.class?.trim() || "Unassigned"]));
      const byClass = new Map<string, { totalNet: number; totalPaid: number }>();
      for (const f of store.fees) {
        const cls = studentClassById.get(f.student_id) ?? "Unassigned";
        const entry = byClass.get(cls) ?? { totalNet: 0, totalPaid: 0 };
        entry.totalNet += f.net_amount;
        entry.totalPaid += f.paid_amount;
        byClass.set(cls, entry);
      }
      const report: ClassReportRow[] = [...byClass.entries()]
        .map(([className, v]) => ({ className, totalNet: v.totalNet, totalPaid: v.totalPaid, outstanding: Math.max(0, v.totalNet - v.totalPaid) }))
        .sort((a, b) => b.outstanding - a.outstanding);
      setClassReport(report);

      // Teacher Salaries record
      const teacherById = new Map(store.teachers.map((t) => [t.id, t]));
      const salaries = [...store.salaries]
        .sort((a, b) => (a.month < b.month ? 1 : -1))
        .map((s) => ({ ...s, teacher_name: teacherById.get(s.teacher_id)?.full_name ?? "(unknown teacher)" }));
      setSalaryRows(salaries);

      // Fee defaulters this month (monthly fee heads only)
      const monthlyHeadNames = new Set(store.fee_heads.filter((h) => h.is_monthly).map((h) => h.name));
      const activeStudents = store.students.filter((s) => s.status !== "inactive");
      const defaulters: { student: Student; owed: number }[] = [];
      if (monthlyHeadNames.size > 0) {
        for (const student of activeStudents) {
          const monthFees = store.fees.filter(
            (f) => f.student_id === student.id && f.month === currentMonthKey() && monthlyHeadNames.has(f.fee_head)
          );
          const owed = monthFees.reduce((sum, f) => sum + Math.max(0, f.net_amount - f.paid_amount), 0);
          if (owed > 0) defaulters.push({ student, owed });
        }
      }
      setFeeDefaulters(defaulters);
    })();
  }, []);

  const netBalance = collectedThisMonth - expensesThisMonth;
  const totalSalariesPaid = salaryRows.reduce((sum, s) => sum + s.paid_amount, 0);

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Finance</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="w-4 h-4" />} label="Collected This Month" value={`Rs. ${collectedThisMonth.toLocaleString()}`} tone="accent" />
        <StatCard icon={<TrendingDown className="w-4 h-4" />} label="Total Outstanding" value={`Rs. ${outstanding.toLocaleString()}`} tone="danger" />
        <StatCard icon={<Receipt className="w-4 h-4" />} label="Expenses This Month" value={`Rs. ${expensesThisMonth.toLocaleString()}`} tone="warn" />
        <StatCard
          icon={<Scale className="w-4 h-4" />}
          label="Net Balance (This Month)"
          value={`Rs. ${netBalance.toLocaleString()}`}
          tone={netBalance >= 0 ? "accent" : "danger"}
        />
      </div>

      {feeDefaulters.length > 0 && (
        <div className="card border-danger/30 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-danger" />
            <h3 className="font-medium text-sm">Fee Defaulters — {monthLabelLong(currentMonthKey())}</h3>
          </div>
          <p className="text-xs text-ink-muted">Students who haven't paid this month's tuition/monthly fee yet.</p>
          <div className="flex flex-wrap gap-2">
            {feeDefaulters.map(({ student, owed }) => (
              <span key={student.id} className="inline-flex items-center gap-1.5 text-xs rounded-full bg-danger/15 text-danger px-3 py-1.5">
                {student.full_name} ({student.class}) — Rs. {owed.toLocaleString()} due
                {student.parent_phone && (
                  <button onClick={() => setReminderFor({ student, owed })} title="Send WhatsApp Reminder" className="hover:opacity-70">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-display font-semibold mb-4">Income vs Expenses — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
            <XAxis dataKey="month" stroke="rgb(var(--ink-muted))" fontSize={12} />
            <YAxis stroke="rgb(var(--ink-muted))" fontSize={12} />
            <Tooltip contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", borderRadius: 8 }} labelStyle={{ color: "rgb(var(--ink))" }} />
            <Legend />
            <Bar dataKey="Income" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Expenses" fill="#E05252" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-display font-semibold">Class-wise Collection Report</h3>
          <button
            onClick={() => exportToCsv(classReport, "class-collection-report")}
            className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 py-1.5 hover:bg-surface transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-4 py-3">Class</th>
              <th className="text-left font-medium px-4 py-3">Total Billed</th>
              <th className="text-left font-medium px-4 py-3">Total Collected</th>
              <th className="text-left font-medium px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {classReport.map((r) => (
              <tr key={r.className} className="hover:bg-surface-raised/50">
                <td className="px-4 py-3 font-medium">{r.className}</td>
                <td className="px-4 py-3">Rs. {r.totalNet.toLocaleString()}</td>
                <td className="px-4 py-3">Rs. {r.totalPaid.toLocaleString()}</td>
                <td className="px-4 py-3 text-danger">Rs. {r.outstanding.toLocaleString()}</td>
              </tr>
            ))}
            {classReport.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-ink-muted py-8">No fee records yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-accent" />
            <h3 className="font-display font-semibold">Teacher Salaries Record</h3>
          </div>
          <div className="text-xs text-ink-muted">Total Paid (All Time): <span className="text-accent font-medium">Rs. {totalSalariesPaid.toLocaleString()}</span></div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-4 py-3">Teacher</th>
              <th className="text-left font-medium px-4 py-3">Month</th>
              <th className="text-left font-medium px-4 py-3">Net Salary</th>
              <th className="text-left font-medium px-4 py-3">Paid</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {salaryRows.map((s) => (
              <tr key={s.id} className="hover:bg-surface-raised/50">
                <td className="px-4 py-3 font-medium">{s.teacher_name}</td>
                <td className="px-4 py-3">{monthLabelLong(s.month)}</td>
                <td className="px-4 py-3">Rs. {s.net_salary.toLocaleString()}</td>
                <td className="px-4 py-3">Rs. {s.paid_amount.toLocaleString()}</td>
                <td className="px-4 py-3"><SalaryStatusPill status={s.status} /></td>
              </tr>
            ))}
            {salaryRows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-muted py-8">No salary records yet — process one in Payroll.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {reminderFor && (
        <WhatsAppReminderModal
          studentName={reminderFor.student.full_name}
          parentPhone={reminderFor.student.parent_phone}
          amount={reminderFor.owed}
          month={monthLabelLong(currentMonthKey())}
          schoolName={school.name}
          template={school.feeReminderTemplate}
          onClose={() => setReminderFor(null)}
        />
      )}
    </div>
  );
}

function SalaryStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-accent-soft text-accent",
    partial: "bg-warn/15 text-warn",
    unpaid: "bg-danger/15 text-danger",
  };
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${styles[status] ?? ""}`}>{status}</span>;
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "accent" | "danger" | "warn";
}) {
  const toneClasses: Record<string, string> = {
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger/15 text-danger",
    warn: "bg-warn/15 text-warn",
  };
  return (
    <div className="card">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${toneClasses[tone]}`}>{icon}</div>
      <div className="text-xs text-ink-muted mb-1">{label}</div>
      <div className="font-display font-semibold text-lg">{value}</div>
    </div>
  );
}
