import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Wallet, Printer, Settings2, Pencil, X, Search, HandCoins, CalendarPlus, MessageCircle } from "lucide-react";
import {
  getAll,
  insertRow,
  updateRow,
  deleteRow,
  getStore,
  getSchoolProfile,
  recordFeePayment,
  generateMonthlyFees,
  Student,
  FeeHead,
  SchoolProfile,
} from "../db/db";
import { exportToCsv } from "../lib/importExport";
import ReceiptModal, { ReceiptData } from "../components/ReceiptModal";
import WhatsAppReminderModal from "../components/WhatsAppReminderModal";

interface FeeRow {
  id: number;
  student_id: number;
  full_name: string;
  student_class: string;
  parent_phone: string;
  fee_head: string;
  month: string;
  amount: number;
  discount: number;
  discount_type: "flat" | "percent";
  net_amount: number;
  paid_amount: number;
  paid_date: string | null;
  payment_method: string;
  status: string;
}

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online"];
const STATUS_OPTIONS = ["paid", "partial", "unpaid"];

const emptyForm = {
  student_id: "",
  fee_head: "",
  month: "",
  amount: "",
  discount: "0",
  discount_type: "flat" as "flat" | "percent",
  paid_amount: "0",
  paid_date: "",
  payment_method: "Cash",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Fees() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHead[]>([]);
  const [school, setSchool] = useState<SchoolProfile>({ name: "", address: "", phone: "", feeReminderTemplate: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showHeadManager, setShowHeadManager] = useState(false);
  const [newHeadName, setNewHeadName] = useState("");
  const [newHeadAmount, setNewHeadAmount] = useState("");
  const [newHeadMonthly, setNewHeadMonthly] = useState(true);
  const [newHeadUseStudentFee, setNewHeadUseStudentFee] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [reminderFor, setReminderFor] = useState<FeeRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payFor, setPayFor] = useState<FeeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [needsMonthlyGen, setNeedsMonthlyGen] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  async function refresh() {
    setStudents(await getAll<Student>("students"));
    setFeeHeads(await getAll<FeeHead>("fee_heads"));
    setSchool(await getSchoolProfile());
    const store = await getStore();
    const studentById = new Map(store.students.map((s) => [s.id, s]));
    const joined = [...store.fees]
      .sort((a, b) => b.id - a.id)
      .map((f) => ({
        ...f,
        full_name: studentById.get(f.student_id)?.full_name ?? "(unknown student)",
        student_class: studentById.get(f.student_id)?.class ?? "",
        parent_phone: studentById.get(f.student_id)?.parent_phone ?? "",
      }));
    setFees(joined as FeeRow[]);

    const hasMonthlyHeads = store.fee_heads.some((h) => h.is_monthly);
    setNeedsMonthlyGen(hasMonthlyHeads && store.lastMonthlyFeeGeneration !== currentMonthKey());
  }

  useEffect(() => {
    refresh();
  }, []);

  function computeNet(amount: number, discount: number, type: "flat" | "percent") {
    const net = type === "percent" ? amount - (amount * discount) / 100 : amount - discount;
    return Math.max(0, Math.round(net));
  }

  function deriveStatus(net: number, paid: number): string {
    if (paid <= 0) return "unpaid";
    if (paid >= net) return "paid";
    return "partial";
  }

  function amountForHead(head: FeeHead | undefined, studentId: string): number | null {
    if (!head) return null;
    if (head.use_student_fee) {
      const student = students.find((s) => String(s.id) === studentId);
      return student?.monthly_fee ?? 0;
    }
    return head.default_amount;
  }

  function handleFeeHeadChange(headName: string) {
    const head = feeHeads.find((h) => h.name === headName);
    const amount = amountForHead(head, form.student_id);
    setForm({ ...form, fee_head: headName, amount: amount != null ? String(amount) : form.amount });
  }

  function handleStudentChange(studentId: string) {
    const head = feeHeads.find((h) => h.name === form.fee_head);
    const amount = head?.use_student_fee ? amountForHead(head, studentId) : null;
    setForm({ ...form, student_id: studentId, ...(amount != null ? { amount: String(amount) } : {}) });
  }
  function startEdit(f: FeeRow) {
    setEditingId(f.id);
    setForm({
      student_id: String(f.student_id),
      fee_head: f.fee_head,
      month: f.month,
      amount: String(f.amount),
      discount: String(f.discount),
      discount_type: f.discount_type,
      paid_amount: String(f.paid_amount),
      paid_date: f.paid_date ?? "",
      payment_method: f.payment_method,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.student_id || !form.fee_head || !form.month || !form.amount) return;
    const amount = parseFloat(form.amount);
    const discount = parseFloat(form.discount || "0");
    const paid_amount = parseFloat(form.paid_amount || "0");
    const net_amount = computeNet(amount, discount, form.discount_type);

    const row = {
      student_id: Number(form.student_id),
      fee_head: form.fee_head,
      month: form.month,
      amount,
      discount,
      discount_type: form.discount_type,
      net_amount,
      paid_amount,
      paid_date: form.paid_date || null,
      payment_method: form.payment_method,
      status: deriveStatus(net_amount, paid_amount),
    };

    if (editingId !== null) {
      await updateRow("fees", editingId, row);
      setEditingId(null);
    } else {
      await insertRow("fees", row);
    }
    setForm(emptyForm);
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("fees", id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  async function handleAddFeeHead() {
    if (!newHeadName.trim()) return;
    await insertRow("fee_heads", {
      name: newHeadName.trim(),
      default_amount: Number(newHeadAmount || 0),
      is_monthly: newHeadMonthly,
      use_student_fee: newHeadUseStudentFee,
    });
    setNewHeadName("");
    setNewHeadAmount("");
    refresh();
  }

  async function handleDeleteFeeHead(id: number) {
    await deleteRow("fee_heads", id);
    refresh();
  }

  function openReceipt(f: FeeRow) {
    setReceipt({
      receiptNo: `RCPT-${f.id.toString().padStart(5, "0")}`,
      studentName: f.full_name,
      studentClass: f.student_class,
      feeHead: f.fee_head,
      month: f.month,
      amount: f.amount,
      discount: f.discount,
      netAmount: f.net_amount,
      paidAmount: f.paid_amount,
      paidDate: f.paid_date,
      paymentMethod: f.payment_method,
    });
  }

  function openPayRemaining(f: FeeRow) {
    setPayFor(f);
    setPayAmount(String(Math.max(0, f.net_amount - f.paid_amount)));
    setPayMethod(f.payment_method || "Cash");
  }

  async function submitPayment() {
    if (!payFor) return;
    const amount = parseFloat(payAmount || "0");
    if (amount <= 0) return;
    await recordFeePayment(payFor.id, amount, todayISO(), payMethod);
    setPayFor(null);
    refresh();
  }

  async function handleGenerateMonthly() {
    setGenStatus("Generating…");
    const result = await generateMonthlyFees(currentMonthKey());
    setGenStatus(`Created ${result.created} fee record(s) for this month.`);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fees.filter((f) => {
      const matchesSearch = !q || f.full_name.toLowerCase().includes(q) || f.fee_head.toLowerCase().includes(q) || f.month.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [fees, search, statusFilter]);

  const totalOutstanding = fees.reduce((sum, f) => sum + Math.max(0, f.net_amount - f.paid_amount), 0);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Fee Ledger</h2>
        <div className="flex items-center gap-2">
          <ToolbarButton icon={<Settings2 className="w-4 h-4" />} label="Fee Heads" onClick={() => setShowHeadManager((v) => !v)} />
          <ToolbarButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={() => exportToCsv(fees, "fees")} />
        </div>
      </div>

      {needsMonthlyGen && (
        <div className="card border-accent/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarPlus className="w-5 h-5 text-accent" />
            <div>
              <div className="text-sm font-medium">This month's fees haven't been generated yet</div>
              <p className="text-xs text-ink-muted">Creates one fee record per student for each Fee Head marked "monthly."</p>
            </div>
          </div>
          <button onClick={handleGenerateMonthly} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition whitespace-nowrap">
            Generate This Month's Fees
          </button>
        </div>
      )}
      {genStatus && <p className="text-sm text-ink-muted">{genStatus}</p>}

      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
          <Wallet className="w-5 h-5 text-accent" />
        </div>
        <div>
          <div className="text-xs text-ink-muted">Total Outstanding</div>
          <div className="font-display font-semibold text-lg">Rs. {totalOutstanding.toLocaleString()}</div>
        </div>
      </div>

      {showHeadManager && (
        <div className="card space-y-3">
          <h3 className="font-medium text-sm">Manage Fee Heads</h3>
          <div className="flex flex-wrap gap-2">
            {feeHeads.map((h) => (
              <span key={h.id} className="inline-flex items-center gap-2 text-xs rounded-full bg-surface-raised border border-border px-3 py-1.5">
                {h.name} · {h.use_student_fee ? "each student's own Monthly Fee" : `Rs. ${h.default_amount.toLocaleString()}`} {h.is_monthly && <span className="text-accent">· monthly</span>}
                <button onClick={() => handleDeleteFeeHead(h.id)} className="text-danger hover:opacity-80">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
            {feeHeads.length === 0 && <span className="text-xs text-ink-muted">No fee heads yet — add one below (e.g. Tuition, Transport).</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input" placeholder="Fee Head Name" value={newHeadName} onChange={(e) => setNewHeadName(e.target.value)} />
            <input
              className="input"
              type="number"
              placeholder="Default Amount"
              value={newHeadAmount}
              onChange={(e) => setNewHeadAmount(e.target.value)}
              disabled={newHeadUseStudentFee}
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted whitespace-nowrap">
              <input type="checkbox" checked={newHeadMonthly} onChange={(e) => setNewHeadMonthly(e.target.checked)} />
              Recurs monthly
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted whitespace-nowrap">
              <input type="checkbox" checked={newHeadUseStudentFee} onChange={(e) => setNewHeadUseStudentFee(e.target.checked)} />
              Use each student's own Monthly Fee (for "School Fees")
            </label>
            <button onClick={handleAddFeeHead} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm whitespace-nowrap hover:opacity-90 transition">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Fee Record" : "Add Fee Record"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <select className="input" value={form.student_id} onChange={(e) => handleStudentChange(e.target.value)}>
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name} {s.class ? `(${s.class})` : ""}</option>
            ))}
          </select>
          <select className="input" value={form.fee_head} onChange={(e) => handleFeeHeadChange(e.target.value)}>
            <option value="">Fee Head</option>
            {feeHeads.map((h) => (
              <option key={h.id} value={h.name}>{h.name}</option>
            ))}
          </select>
          <input className="input" placeholder="Month (e.g. July 2026)" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          <input className="input" type="number" placeholder="Amount (Rs.)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />

          <div className="flex gap-2 col-span-2 sm:col-span-1">
            <input className="input" type="number" placeholder="Discount" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            <select className="input w-24" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as "flat" | "percent" })}>
              <option value="flat">Rs.</option>
              <option value="percent">%</option>
            </select>
          </div>
          <input className="input" type="number" placeholder="Amount Paid" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
          <input className="input" type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} />
          <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {form.amount && (
          <p className="text-xs text-ink-muted">
            Net payable: <span className="text-accent font-medium">
              Rs. {computeNet(parseFloat(form.amount || "0"), parseFloat(form.discount || "0"), form.discount_type).toLocaleString()}
            </span>
          </p>
        )}

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Fee Record" : "Add Fee Record"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input className="input pl-9" placeholder="Search by student, fee head, or month…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <Th>Student</Th><Th>Fee Head</Th><Th>Month</Th><Th>Net</Th><Th>Paid</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-surface-raised/50">
                <Td className="font-medium">{f.full_name}</Td>
                <Td>{f.fee_head}</Td>
                <Td>{f.month}</Td>
                <Td>Rs. {f.net_amount.toLocaleString()}</Td>
                <Td>Rs. {f.paid_amount.toLocaleString()}</Td>
                <Td><StatusPill status={f.status} /></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {f.status !== "paid" && (
                      <button onClick={() => openPayRemaining(f)} className="text-ink-muted hover:text-accent" title="Record Payment">
                        <HandCoins className="w-4 h-4" />
                      </button>
                    )}
                    {f.status !== "paid" && f.parent_phone && (
                      <button onClick={() => setReminderFor(f)} className="text-ink-muted hover:text-accent" title="Send WhatsApp Reminder">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openReceipt(f)} className="text-ink-muted hover:text-accent" title="Print Receipt">
                      <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(f)} className="text-ink-muted hover:text-accent" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(f.id)} className="text-danger hover:opacity-80" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-muted py-8">
                  {fees.length === 0 ? "No fee records yet — add one above." : "No records match your search/filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {receipt && <ReceiptModal data={receipt} school={school} onClose={() => setReceipt(null)} />}

      {reminderFor && (
        <WhatsAppReminderModal
          studentName={reminderFor.full_name}
          parentPhone={reminderFor.parent_phone}
          amount={Math.max(0, reminderFor.net_amount - reminderFor.paid_amount)}
          month={reminderFor.month}
          schoolName={school.name}
          template={school.feeReminderTemplate}
          onClose={() => setReminderFor(null)}
        />
      )}

      {payFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Record Payment — {payFor.full_name}</h3>
              <button onClick={() => setPayFor(null)} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-ink-muted">
              {payFor.fee_head} · {payFor.month} · Remaining: Rs. {Math.max(0, payFor.net_amount - payFor.paid_amount).toLocaleString()}
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

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface transition">
      {icon} {label}
    </button>
  );
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
