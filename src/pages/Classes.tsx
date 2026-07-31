import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, School, Pencil, X, Search, Layers } from "lucide-react";
import { getAll, insertRow, updateRow, deleteRow, getStore, getClassNames, addClassName, removeClassName, ClassRow, Teacher } from "../db/db";

interface ClassWithTeachers extends ClassRow {
  teacher_names: string;
}

const emptyForm = { name: "", section: "", teacher_ids: [] as number[], default_monthly_fee: "" };

export default function Classes() {
  const [classes, setClasses] = useState<ClassWithTeachers[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showClassManager, setShowClassManager] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  async function refresh() {
    setTeachers(await getAll<Teacher>("teachers"));
    setClassNames(await getClassNames());
    const store = await getStore();
    const teacherById = new Map(store.teachers.map((t) => [t.id, t]));
    const joined = [...store.classes]
      .sort((a, b) => b.id - a.id)
      .map((c) => ({
        ...c,
        teacher_names: (c.teacher_ids ?? []).map((id) => teacherById.get(id)?.full_name).filter(Boolean).join(", ") || "—",
      }));
    setClasses(joined);
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleTeacher(teacherId: number) {
    setForm((f) => ({
      ...f,
      teacher_ids: f.teacher_ids.includes(teacherId) ? f.teacher_ids.filter((id) => id !== teacherId) : [...f.teacher_ids, teacherId],
    }));
  }

  function startEdit(c: ClassRow) {
    setEditingId(c.id);
    setForm({ name: c.name, section: c.section, teacher_ids: c.teacher_ids ?? [], default_monthly_fee: String(c.default_monthly_fee ?? "") });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const row = {
      name: form.name.trim(),
      section: form.section.trim(),
      teacher_ids: form.teacher_ids,
      default_monthly_fee: parseFloat(form.default_monthly_fee || "0"),
    };
    if (editingId !== null) {
      await updateRow("classes", editingId, row);
      setEditingId(null);
    } else {
      await insertRow("classes", row);
    }
    setForm(emptyForm);
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("classes", id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  async function handleAddClassName() {
    if (!newClassName.trim()) return;
    await addClassName(newClassName.trim());
    setNewClassName("");
    refresh();
  }

  async function handleRemoveClassName(name: string) {
    await removeClassName(name);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q) || c.section?.toLowerCase().includes(q));
  }, [classes, search]);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Classes</h2>
        <ToolbarButton icon={<Layers className="w-4 h-4" />} label="Class Names" onClick={() => setShowClassManager((v) => !v)} />
      </div>

      {showClassManager && (
        <div className="card space-y-3">
          <h3 className="font-medium text-sm">Manage Class Names</h3>
          <p className="text-xs text-ink-muted">
            Define class names once here (e.g. "Grade 5"), then add each of its sections (A, B, C…) below —
            this list also drives the Class dropdown on the Students page.
          </p>
          <div className="flex flex-wrap gap-2">
            {classNames.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-xs rounded-full bg-surface-raised border border-border px-3 py-1.5">
                {c}
                <button onClick={() => handleRemoveClassName(c)} className="text-danger hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {classNames.length === 0 && <span className="text-xs text-ink-muted">No class names yet — add one below.</span>}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="New class name (e.g. Grade 6)" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
            <button onClick={handleAddClassName} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm whitespace-nowrap hover:opacity-90 transition">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Section" : "Add Section"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}>
            <option value="">Select Class</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" placeholder="Section (e.g. A)" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Default Monthly Fee (Rs.)</span>
            <input
              className="input"
              type="number"
              placeholder="e.g. 3000"
              value={form.default_monthly_fee}
              onChange={(e) => setForm({ ...form, default_monthly_fee: e.target.value })}
            />
          </label>
        </div>
        <p className="text-xs text-ink-muted -mt-2">
          This amount pre-fills the Monthly Fee when a new student is added to this class/section on the Students
          page — still fully editable per student for scholarships or custom rates.
        </p>
        {classNames.length === 0 && (
          <p className="text-xs text-warn">Add a class name above first (click "Class Names").</p>
        )}

        <div>
          <div className="text-xs text-ink-muted mb-2">Teachers Assigned (select all that apply)</div>
          <div className="flex flex-wrap gap-2">
            {teachers.length === 0 && <span className="text-xs text-ink-muted">No teachers yet.</span>}
            {teachers.map((t) => (
              <label
                key={t.id}
                className={`inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  form.teacher_ids.includes(t.id) ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted"
                }`}
              >
                <input type="checkbox" className="hidden" checked={form.teacher_ids.includes(t.id)} onChange={() => toggleTeacher(t.id)} />
                {t.full_name}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Section" : "Add Section"}
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input className="input pl-9" placeholder="Search by class or section…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-4 py-3">Class</th>
              <th className="text-left font-medium px-4 py-3">Section</th>
              <th className="text-left font-medium px-4 py-3">Default Fee</th>
              <th className="text-left font-medium px-4 py-3">Teachers</th>
              <th className="text-left font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-surface-raised/50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.section}</td>
                <td className="px-4 py-3">Rs. {(c.default_monthly_fee ?? 0).toLocaleString()}</td>
                <td className="px-4 py-3">{c.teacher_names}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(c)} className="text-ink-muted hover:text-accent" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-danger hover:opacity-80" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-ink-muted py-10">
                  <School className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  {classes.length === 0 ? "No sections yet — add one above." : "No sections match your search."}
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
