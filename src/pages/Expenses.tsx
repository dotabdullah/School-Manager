import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Receipt, X, Pencil, Search } from "lucide-react";
import { getAll, insertRow, updateRow, deleteRow, getExpenseCategories, addExpenseCategory, removeExpenseCategory, Expense } from "../db/db";
import { exportToCsv } from "../lib/importExport";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Cheque", "Online"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  date: todayISO(),
  category: "",
  amount: "",
  paid_to: "",
  payment_method: "Cash",
  notes: "",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  async function refresh() {
    setExpenses(await getAll<Expense>("expenses"));
    setCategories(await getExpenseCategories());
  }

  useEffect(() => {
    refresh();
  }, []);

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setForm({ date: e.date, category: e.category, amount: String(e.amount), paid_to: e.paid_to, payment_method: e.payment_method, notes: e.notes });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, date: todayISO() });
  }

  async function handleSave() {
    if (!form.category || !form.amount) return;
    const row = {
      date: form.date,
      category: form.category,
      amount: parseFloat(form.amount),
      paid_to: form.paid_to,
      payment_method: form.payment_method,
      notes: form.notes,
    };
    if (editingId !== null) {
      await updateRow("expenses", editingId, row);
      setEditingId(null);
      setForm({ ...emptyForm, date: todayISO() });
    } else {
      await insertRow("expenses", row);
      setForm({ ...emptyForm, date: form.date }); // keep the date, clear the rest
    }
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("expenses", id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    await addExpenseCategory(newCategory.trim());
    setNewCategory("");
    refresh();
  }

  async function handleRemoveCategory(name: string) {
    await removeExpenseCategory(name);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchesSearch = !q || e.category.toLowerCase().includes(q) || e.paid_to?.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const totalThisMonth = expenses
    .filter((e) => e.date.slice(0, 7) === todayISO().slice(0, 7))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Expenses</h2>
        <div className="flex items-center gap-2">
          <ToolbarButton icon={<Receipt className="w-4 h-4" />} label="Categories" onClick={() => setShowCategoryManager((v) => !v)} />
          <ToolbarButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={() => exportToCsv(expenses, "expenses")} />
        </div>
      </div>

      <div className="card flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-danger" />
        </div>
        <div>
          <div className="text-xs text-ink-muted">Total Expenses This Month</div>
          <div className="font-display font-semibold text-lg">Rs. {totalThisMonth.toLocaleString()}</div>
        </div>
      </div>

      {showCategoryManager && (
        <div className="card space-y-3">
          <h3 className="font-medium text-sm">Manage Categories</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-xs rounded-full bg-surface-raised border border-border px-3 py-1.5">
                {c}
                <button onClick={() => handleRemoveCategory(c)} className="text-danger hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="New category (e.g. Transport/Fuel)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            <button onClick={handleAddCategory} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm whitespace-nowrap hover:opacity-90 transition">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Expense" : "Add Expense"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" type="number" placeholder="Amount (Rs.)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="input" placeholder="Paid To" value={form.paid_to} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
          <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <input className="input" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Expense" : "Add Expense"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input className="input pl-9" placeholder="Search by category, paid to, or notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <Th>Date</Th><Th>Category</Th><Th>Amount</Th><Th>Paid To</Th><Th>Method</Th><Th>Notes</Th><Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-surface-raised/50">
                <Td>{e.date}</Td>
                <Td className="font-medium">{e.category}</Td>
                <Td>Rs. {e.amount.toLocaleString()}</Td>
                <Td>{e.paid_to}</Td>
                <Td>{e.payment_method}</Td>
                <Td className="text-ink-muted">{e.notes}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(e)} className="text-ink-muted hover:text-accent" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="text-danger hover:opacity-80" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-muted py-8">
                  {expenses.length === 0 ? "No expenses recorded yet — add one above." : "No expenses match your search/filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
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
