import { useEffect, useMemo, useState } from "react";
import { Download, Upload, FileSpreadsheet, Plus, Trash2, Pencil, X, Search, BookOpen, ImagePlus, User, CreditCard } from "lucide-react";
import { getAll, insertRow, updateRow, deleteRow, getSubjectsList, addSubject, removeSubject, getSchoolProfile, Teacher } from "../db/db";
import { exportToCsv, exportToExcel, importFromFile } from "../lib/importExport";
import { pickAndEncodePhoto } from "../lib/photo";
import IDCardModal, { IDCardData } from "../components/IDCardModal";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  full_name: "",
  subjects: [] as string[],
  phone: "",
  email: "",
  city: "",
  address: "",
  joining_date: todayISO(),
  base_salary: "0",
  photo: "",
};

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [idCardFor, setIdCardFor] = useState<IDCardData | null>(null);
  const [schoolName, setSchoolName] = useState("");

  async function refresh() {
    setTeachers(await getAll<Teacher>("teachers"));
    setSubjectsList(await getSubjectsList());
    setSchoolName((await getSchoolProfile()).name);
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSubject(subject: string) {
    setForm((f) => ({
      ...f,
      subjects: f.subjects.includes(subject) ? f.subjects.filter((s) => s !== subject) : [...f.subjects, subject],
    }));
  }

  async function handlePhotoUpload() {
    const dataUrl = await pickAndEncodePhoto();
    if (dataUrl) setForm((f) => ({ ...f, photo: dataUrl }));
  }

  function openIDCard(t: Teacher) {
    setIdCardFor({
      schoolName,
      name: t.full_name,
      role: "Teacher",
      idNumber: `T-${String(t.id).padStart(4, "0")}`,
      subtitle: (t.subjects ?? []).join(", ") || "Teacher",
      extra: t.phone || undefined,
      photo: t.photo || "",
    });
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id);
    setForm({
      full_name: t.full_name,
      subjects: t.subjects ?? [],
      phone: t.phone,
      email: t.email,
      city: t.city ?? "",
      address: t.address ?? "",
      joining_date: t.joining_date || todayISO(),
      base_salary: String(t.base_salary ?? 0),
      photo: t.photo || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...emptyForm, joining_date: todayISO() });
  }

  async function handleSave() {
    if (!form.full_name.trim()) return;
    const row = { ...form, base_salary: parseFloat(form.base_salary || "0") };
    if (editingId !== null) {
      await updateRow("teachers", editingId, row);
      setEditingId(null);
    } else {
      await insertRow("teachers", row);
    }
    setForm({ ...emptyForm, joining_date: todayISO() });
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("teachers", id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  async function handleImport() {
    setStatus("Importing…");
    const result = await importFromFile("teachers");
    setStatus(`Imported ${result.inserted}, skipped ${result.skipped}.`);
    refresh();
  }

  async function handleAddSubject() {
    if (!newSubject.trim()) return;
    await addSubject(newSubject.trim());
    setNewSubject("");
    refresh();
  }

  async function handleRemoveSubject(name: string) {
    await removeSubject(name);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.full_name.toLowerCase().includes(q) || t.subjects?.some((s) => s.toLowerCase().includes(q)));
  }, [teachers, search]);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Teachers</h2>
        <div className="flex items-center gap-2">
          <ToolbarButton icon={<BookOpen className="w-4 h-4" />} label="Subjects" onClick={() => setShowSubjectManager((v) => !v)} />
          <ToolbarButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={() => exportToCsv(teachers, "teachers")} />
          <ToolbarButton icon={<FileSpreadsheet className="w-4 h-4" />} label="Export Excel" onClick={() => exportToExcel(teachers, "teachers")} />
          <ToolbarButton icon={<Upload className="w-4 h-4" />} label="Import" onClick={handleImport} />
        </div>
      </div>
      {status && <p className="text-sm text-ink-muted">{status}</p>}

      {showSubjectManager && (
        <div className="card space-y-3">
          <h3 className="font-medium text-sm">Manage Subjects</h3>
          <div className="flex flex-wrap gap-2">
            {subjectsList.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 text-xs rounded-full bg-surface-raised border border-border px-3 py-1.5">
                {s}
                <button onClick={() => handleRemoveSubject(s)} className="text-danger hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="New subject (e.g. Chemistry)" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            <button onClick={handleAddSubject} className="rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm whitespace-nowrap hover:opacity-90 transition">
              Add
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Teacher" : "Add Teacher"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {form.photo ? (
            <img src={form.photo} className="w-14 h-14 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-surface-raised border border-border flex items-center justify-center text-ink-muted">
              <User className="w-6 h-6" />
            </div>
          )}
          <button onClick={handlePhotoUpload} className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-surface-raised transition">
            <ImagePlus className="w-3.5 h-3.5" /> {form.photo ? "Change Photo" : "Upload Photo"}
          </button>
          <span className="text-xs text-ink-muted">Used on printed ID cards</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <input className="input" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Joining Date</span>
            <input type="date" className="input" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
          </label>
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Base Salary (Rs., reference — set actual payroll amounts in Payroll)</span>
            <input className="input" type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
          </label>
        </div>

        <div>
          <div className="text-xs text-ink-muted mb-2">Subjects Taught (select all that apply)</div>
          <div className="flex flex-wrap gap-2">
            {subjectsList.length === 0 && <span className="text-xs text-ink-muted">No subjects defined — click "Subjects" above to add some.</span>}
            {subjectsList.map((s) => (
              <label
                key={s}
                className={`inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  form.subjects.includes(s) ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted"
                }`}
              >
                <input type="checkbox" className="hidden" checked={form.subjects.includes(s)} onChange={() => toggleSubject(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Teacher" : "Add Teacher"}
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input className="input pl-9" placeholder="Search by name or subject…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <Th>Name</Th><Th>Subjects</Th><Th>Phone</Th><Th>City</Th><Th>Joined</Th><Th>Base Salary</Th><Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-surface-raised/50">
                <Td className="font-medium">{t.full_name}</Td>
                <Td>{(t.subjects ?? []).join(", ")}</Td>
                <Td>{t.phone}</Td>
                <Td>{t.city}</Td>
                <Td>{t.joining_date}</Td>
                <Td>Rs. {(t.base_salary ?? 0).toLocaleString()}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openIDCard(t)} className="text-ink-muted hover:text-accent" title="Print ID Card">
                      <CreditCard className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(t)} className="text-ink-muted hover:text-accent" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-danger hover:opacity-80" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-ink-muted py-8">
                  {teachers.length === 0 ? "No teachers yet — add one above or import a spreadsheet." : "No teachers match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {idCardFor && <IDCardModal data={idCardFor} onClose={() => setIdCardFor(null)} />}
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
