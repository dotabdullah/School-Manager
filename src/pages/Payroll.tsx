import { useEffect, useMemo, useState } from "react";
import { Wallet, Save, Trash2, Pencil, X, Search, Printer, Calculator, HandCoins, BellRing } from "lucide-react";
import {
  getAll,
  getStore,
  updateRow,
  getSchoolProfile,
  getUnpaidDaysForTeacherMonth,
  saveSalary,
  deleteSalary,
  recordSalaryPayment,
  isTeacherPaidForMonth,
  getSalaryDefaultersForMonth,
  Teacher,
  Salary,
  SchoolProfile,
} from "../db/db";
import PayslipModal, { PayslipData } from "../components/PayslipModal";

interface SalaryRow extends Salary {
  teacher_name: string;
  subjects: string;
}

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online"];
const STATUS_OPTIONS = ["unpaid", "partial", "paid"];

function monthLabel(key: string) {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  teacher_id: "",
  monthKey: currentMonthKey(),
  base_salary: "",
  unpaid_days: "0",
  deduction: "0",
  net_salary: "",
  paid_amount: "",
  payment_method: "Cash",
};

export default function Payroll() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [school, setSchool] = useState<SchoolProfile>({ name: "", address: "", phone: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [baseSalaryEdits, setBaseSalaryEdits] = useState<Record<number, string>>({});
  const [payslip, setPayslip] = useState<PayslipData | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [defaulters, setDefaulters] = useState<{ teacher: Teacher; owed: number }[]>([]);
  const [payFor, setPayFor] = useState<SalaryRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");

  async function refresh() {
    const allTeachers = await getAll<Teacher>("teachers");
    setTeachers(allTeachers);
    setSchool(await getSchoolProfile());

    const store = await getStore();
    const teacherById = new Map(store.teachers.map((t) => [t.id, t]));
    const joined = [...store.salaries]
      .sort((a, b) => b.id - a.id)
      .map((s) => ({
        ...s,
        teacher_name: teacherById.get(s.teacher_id)?.full_name ?? "(unknown teacher)",
        subjects: (teacherById.get(s.teacher_id)?.subjects ?? []).join(", "),
      }));
    setSalaries(joined);

    setDefaulters(await getSalaryDefaultersForMonth(currentMonthKey()));
  }

  useEffect(() => {
    refresh();
  }, []);

  function deriveStatus(net: number, paid: number): "unpaid" | "partial" | "paid" {
    if (paid <= 0) return "unpaid";
    if (paid >= net) return "paid";
    return "partial";
  }

  // --- Base salary quick-set ---
  function handleBaseSalaryChange(teacherId: number, value: string) {
    setBaseSalaryEdits((prev) => ({ ...prev, [teacherId]: value }));
  }

  async function saveBaseSalary(teacherId: number) {
    const value = baseSalaryEdits[teacherId];
    if (value === undefined) return;
    await updateRow("teachers", teacherId, { base_salary: parseFloat(value) || 0 });
    setBaseSalaryEdits((prev) => {
      const next = { ...prev };
      delete next[teacherId];
      return next;
    });
    refresh();
  }

  // --- Payroll processing form ---
  async function handleTeacherChange(teacherId: string) {
    const teacher = teachers.find((t) => String(t.id) === teacherId);
    const base = teacher?.base_salary ?? 0;
    const unpaidDays = teacher ? await getUnpaidDaysForTeacherMonth(teacher.id, form.monthKey) : 0;
    const deduction = Math.round((base / 30) * unpaidDays);
    const net = Math.max(0, base - deduction);
    setForm((f) => ({
      ...f,
      teacher_id: teacherId,
      base_salary: String(base),
      unpaid_days: String(unpaidDays),
      deduction: String(deduction),
      net_salary: String(net),
      paid_amount: String(net),
    }));
    setError("");
  }

  async function handleMonthChange(monthKey: string) {
    setForm((f) => ({ ...f, monthKey }));
    if (form.teacher_id) {
      const unpaidDays = await getUnpaidDaysForTeacherMonth(Number(form.teacher_id), monthKey);
      const base = parseFloat(form.base_salary || "0");
      const deduction = Math.round((base / 30) * unpaidDays);
      const net = Math.max(0, base - deduction);
      setForm((f) => ({ ...f, monthKey, unpaid_days: String(unpaidDays), deduction: String(deduction), net_salary: String(net), paid_amount: String(net) }));
    }
  }

  function recomputeNet(base: string, deduction: string) {
    const net = Math.max(0, (parseFloat(base) || 0) - (parseFloat(deduction) || 0));
    setForm((f) => ({ ...f, base_salary: base, deduction, net_salary: String(net) }));
  }

  function startEdit(s: SalaryRow) {
    setEditingId(s.id);
    setForm({
      teacher_id: String(s.teacher_id),
      monthKey: s.month,
      base_salary: String(s.base_salary),
      unpaid_days: String(s.unpaid_days),
      deduction: String(s.deduction),
      net_salary: String(s.net_salary),
      paid_amount: String(s.paid_amount),
      payment_method: s.payment_method,
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
    setForm({ ...emptyForm, monthKey: currentMonthKey() });
  }

  async function handleSave() {
    setError("");
    if (!form.teacher_id || !form.monthKey) return;

    if (editingId === null && (await isTeacherPaidForMonth(Number(form.teacher_id), form.monthKey))) {
      return setError(
        `This teacher already has a salary record for ${monthLabel(form.monthKey)}. Use "Record Payment" on that record to pay the remainder instead of creating a new one.`
      );
    }

    setStatus("Saving…");
    const net_salary = parseFloat(form.net_salary || "0");
    const paid_amount = parseFloat(form.paid_amount || "0");
    await saveSalary(editingId, {
      teacher_id: Number(form.teacher_id),
      month: form.monthKey,
      base_salary: parseFloat(form.base_salary || "0"),
      unpaid_days: parseFloat(form.unpaid_days || "0"),
      deduction: parseFloat(form.deduction || "0"),
      net_salary,
      paid_amount,
      status: deriveStatus(net_salary, paid_amount),
      paid_date: paid_amount > 0 ? todayISO() : null,
      payment_method: form.payment_method,
    });
    setEditingId(null);
    setForm({ ...emptyForm, monthKey: currentMonthKey() });
    setStatus("Saved. Expenses ledger updated to match amount actually paid.");
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteSalary(id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  function openPayRemaining(s: SalaryRow) {
    setPayFor(s);
    setPayAmount(String(Math.max(0, s.net_salary - s.paid_amount)));
    setPayMethod(s.payment_method || "Cash");
  }

  async function submitPayment() {
    if (!payFor) return;
    const amount = parseFloat(payAmount || "0");
    if (amount <= 0) return;
    await recordSalaryPayment(payFor.id, amount, todayISO(), payMethod);
    setPayFor(null);
    refresh();
  }

  function openPayslip(s: SalaryRow) {
    setPayslip({
      payslipNo: `PAY-${s.id.toString().padStart(5, "0")}`,
      teacherName: s.teacher_name,
      subject: s.subjects,
      month: monthLabel(s.month),
      baseSalary: s.base_salary,
      unpaidDays: s.unpaid_days,
      deduction: s.deduction,
      netSalary: s.net_salary,
      status: s.status === "paid" ? "paid" : "pending",
      paidDate: s.paid_date,
      paymentMethod: s.payment_method,
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return salaries.filter((s) => {
      const matchesSearch = !q || s.teacher_name.toLowerCase().includes(q) || monthLabel(s.month).toLowerCase().includes(q);
      const matchesStatus = !statusFilter || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salaries, search, statusFilter]);

  const totalPaidThisMonth = salaries
    .filter((s) => s.month === currentMonthKey())
    .reduce((sum, s) => sum + s.paid_amount, 0);

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Payroll &amp; Teacher Salaries</h2>

      {defaulters.length > 0 && (
        <div className="card border-warn/40 space-y-2">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-warn" />
            <h3 className="font-medium text-sm">Salaries Due — {monthLabel(currentMonthKey())}</h3>
          </div>
          <p className="text-xs text-ink-muted">These teachers haven't been fully paid for this month yet.</p>
          <div className="flex flex-wrap gap-2">
            {defaulters.map(({ teacher, owed }) => (
              <span key={teacher.id} className="text-xs rounded-full bg-warn/15 text-warn px-3 py-1.5">
                {teacher.full_name} — Rs. {owed.toLocaleString()} due
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
          <Wallet className="w-5 h-5 text-accent" />
        </div>
        <div>
          <div className="text-xs text-ink-muted">Paid This Month</div>
          <div className="font-display font-semibold text-lg">Rs. {totalPaidThisMonth.toLocaleString()}</div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-medium text-sm">Base Salaries</h3>
        <div className="space-y-2">
          {teachers.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{t.full_name} <span className="text-ink-muted text-xs">· {(t.subjects ?? []).join(", ")}</span></span>
              <input
                className="input w-32"
                type="number"
                value={baseSalaryEdits[t.id] ?? String(t.base_salary ?? 0)}
                onChange={(e) => handleBaseSalaryChange(t.id, e.target.value)}
              />
              <button
                onClick={() => saveBaseSalary(t.id)}
                className="text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-surface-raised transition"
              >
                Save
              </button>
            </div>
          ))}
          {teachers.length === 0 && <p className="text-sm text-ink-muted">No teachers yet — add teachers first.</p>}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Salary Record" : "Process Monthly Salary"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <select className="input" value={form.teacher_id} onChange={(e) => handleTeacherChange(e.target.value)} disabled={editingId !== null}>
            <option value="">Select Teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <input type="month" className="input" value={form.monthKey} onChange={(e) => handleMonthChange(e.target.value)} disabled={editingId !== null} />
          <input
            className="input"
            type="number"
            placeholder="Base Salary"
            value={form.base_salary}
            onChange={(e) => recomputeNet(e.target.value, form.deduction)}
          />
          <input
            className="input"
            type="number"
            placeholder="Unpaid Days"
            value={form.unpaid_days}
            onChange={(e) => {
              const base = parseFloat(form.base_salary || "0");
              const days = parseFloat(e.target.value || "0");
              const deduction = Math.round((base / 30) * days);
              setForm((f) => ({ ...f, unpaid_days: e.target.value, deduction: String(deduction), net_salary: String(Math.max(0, base - deduction)) }));
            }}
          />
          <input
            className="input"
            type="number"
            placeholder="Deduction (Rs.)"
            value={form.deduction}
            onChange={(e) => recomputeNet(form.base_salary, e.target.value)}
          />
          <input className="input font-medium" type="number" placeholder="Net Salary" value={form.net_salary} onChange={(e) => setForm({ ...form, net_salary: e.target.value })} />
          <input className="input" type="number" placeholder="Amount Paid Now" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
          <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-ink-muted flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          Deduction auto-suggested from Attendance (absent/leave days ÷ 30 × base salary). "Amount Paid Now" can be less
          than Net Salary for a partial payment — use "Record Payment" on the saved row later to pay the remainder.
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Save className="w-4 h-4" /> {editingId !== null ? "Update Salary" : "Process Salary"}
        </button>
        {status && <p className="text-sm text-ink-muted">{status}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input className="input pl-9" placeholder="Search by teacher or month…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <Th>Teacher</Th><Th>Month</Th><Th>Net</Th><Th>Paid</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-surface-raised/50">
                <Td className="font-medium">{s.teacher_name}</Td>
                <Td>{monthLabel(s.month)}</Td>
                <Td>Rs. {s.net_salary.toLocaleString()}</Td>
                <Td>Rs. {s.paid_amount.toLocaleString()}</Td>
                <Td><StatusPill status={s.status} /></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {s.status !== "paid" && (
                      <button onClick={() => openPayRemaining(s)} className="text-ink-muted hover:text-accent" title="Record Payment">
                        <HandCoins className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openPayslip(s)} className="text-ink-muted hover:text-accent" title="Print Payslip">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(s)} className="text-ink-muted hover:text-accent" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-danger hover:opacity-80" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-ink-muted py-8">
                  {salaries.length === 0 ? "No salary records yet — process one above." : "No records match your search/filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {payslip && <PayslipModal data={payslip} school={school} onClose={() => setPayslip(null)} />}

      {payFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Record Payment — {payFor.teacher_name}</h3>
              <button onClick={() => setPayFor(null)} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-ink-muted">
              {monthLabel(payFor.month)} · Remaining: Rs. {Math.max(0, payFor.net_salary - payFor.paid_amount).toLocaleString()}
            </p>
            <input className="input" type="number" placeholder="Payment Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={submitPayment}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
            >
              <HandCoins className="w-4 h-4" /> Confirm Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-accent-soft text-accent",
    partial: "bg-warn/15 text-warn",
    unpaid: "bg-danger/15 text-danger",
  };
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${styles[status] ?? ""}`}>{status}</span>;
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
