import { useEffect, useMemo, useState } from "react";
import { Download, Upload, FileSpreadsheet, Plus, Trash2, Pencil, X, Search, ShieldAlert, Eye, ImagePlus, User, CreditCard } from "lucide-react";
import {
  getAll,
  insertRow,
  updateRow,
  deleteRow,
  suggestNextAdmissionNo,
  isAdmissionNoTaken,
  isRollNoTaken,
  getClassNames,
  getStore,
  getSchoolProfile,
  ClassRow,
  Fee,
  Student,
} from "../db/db";
import { exportToCsv, exportToExcel, importFromFile } from "../lib/importExport";
import { pickAndEncodePhoto } from "../lib/photo";
import IDCardModal, { IDCardData } from "../components/IDCardModal";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  admission_no: "",
  roll_no: "",
  full_name: "",
  father_name: "",
  class: "",
  section: "",
  phone: "",
  parent_phone: "",
  parent_email: "",
  admission_date: todayISO(),
  monthly_fee: "",
  photo: "",
};

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [classRecords, setClassRecords] = useState<ClassRow[]>([]);
  const [duesByStudent, setDuesByStudent] = useState<Record<number, number>>({});
  const [feeHistoryFor, setFeeHistoryFor] = useState<{ student: Student; fees: Fee[] } | null>(null);
  const [idCardFor, setIdCardFor] = useState<IDCardData | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  async function refresh() {
    setStudents(await getAll<Student>("students"));
    setClassNames(await getClassNames());
    setClassRecords(await getAll<ClassRow>("classes"));
    setSchoolName((await getSchoolProfile()).name);

    const store = await getStore();
    const dues: Record<number, number> = {};
    for (const f of store.fees) {
      dues[f.student_id] = (dues[f.student_id] ?? 0) + Math.max(0, f.net_amount - f.paid_amount);
    }
    setDuesByStudent(dues);
  }

  async function handlePhotoUpload() {
    const dataUrl = await pickAndEncodePhoto();
    if (dataUrl) setForm((f) => ({ ...f, photo: dataUrl }));
  }

  function openIDCard(s: Student) {
    setIdCardFor({
      schoolName,
      name: s.full_name,
      role: "Student",
      idNumber: s.admission_no,
      subtitle: [s.class, s.section].filter(Boolean).join(" - "),
      extra: s.father_name ? `Father: ${s.father_name}` : undefined,
      photo: s.photo || "",
    });
  }

  function openFeeHistory(s: Student) {
    getStore().then((store) => {
      const fees = store.fees.filter((f) => f.student_id === s.id).sort((a, b) => (a.month < b.month ? 1 : -1));
      setFeeHistoryFor({ student: s, fees });
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (editingId === null) {
      suggestNextAdmissionNo().then((no) => setForm((f) => ({ ...f, admission_no: no })));
    }
  }, [editingId, students.length]);

  const availableSections = useMemo(
    () => classRecords.filter((c) => c.name === form.class).map((c) => c.section).filter(Boolean),
    [classRecords, form.class]
  );

  function handleClassChange(className: string) {
    setForm((f) => ({ ...f, class: className, section: "" }));
  }

  function handleSectionChange(section: string) {
    // Pre-fill the class's default Monthly Fee for a brand-new student only — never
    // overwrite a fee already set while editing an existing student.
    const record = classRecords.find((c) => c.name === form.class && c.section === section);
    const shouldPrefill = editingId === null && record && record.default_monthly_fee > 0;
    setForm((f) => ({ ...f, section, monthly_fee: shouldPrefill ? String(record.default_monthly_fee) : f.monthly_fee }));
  }

  function startEdit(s: Student) {
    setEditingId(s.id);
    setForm({
      admission_no: s.admission_no,
      roll_no: s.roll_no ?? "",
      full_name: s.full_name,
      father_name: s.father_name,
      class: s.class,
      section: s.section,
      phone: s.phone,
      parent_phone: s.parent_phone ?? "",
      parent_email: s.parent_email ?? "",
      admission_date: s.admission_date || todayISO(),
      monthly_fee: String(s.monthly_fee ?? ""),
      photo: s.photo || "",
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
    setForm({ ...emptyForm, admission_date: todayISO() });
  }

  async function handleSave() {
    setError("");
    if (!form.full_name.trim()) return setError("Full name is required.");
    if (!form.admission_no.trim()) return setError("Admission number is required.");

    if (await isAdmissionNoTaken(form.admission_no, editingId ?? undefined)) {
      return setError(`Admission number "${form.admission_no}" is already in use by another student.`);
    }
    if (form.roll_no.trim() && form.class && (await isRollNoTaken(form.roll_no, form.class, editingId ?? undefined))) {
      return setError(`Roll number "${form.roll_no}" is already in use by another student in ${form.class}.`);
    }

    const row = { ...form, monthly_fee: parseFloat(form.monthly_fee || "0") };

    if (editingId !== null) {
      await updateRow("students", editingId, row);
      setEditingId(null);
    } else {
      await insertRow("students", row);
    }
    setForm({ ...emptyForm, admission_date: todayISO() });
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("students", id);
    if (editingId === id) cancelEdit();
    refresh();
  }

  async function handleImport() {
    setStatus("Importing…");
    const result = await importFromFile("students");
    setStatus(`Imported ${result.inserted}, skipped ${result.skipped}.`);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        s.roll_no?.toLowerCase().includes(q) ||
        s.father_name?.toLowerCase().includes(q);
      const matchesClass = !classFilter || s.class === classFilter;
      return matchesSearch && matchesClass;
    });
  }, [students, search, classFilter]);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Students</h2>
        <div className="flex items-center gap-2">
          <ToolbarButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={() => exportToCsv(students, "students")} />
          <ToolbarButton icon={<FileSpreadsheet className="w-4 h-4" />} label="Export Excel" onClick={() => exportToExcel(students, "students")} />
          <ToolbarButton icon={<Upload className="w-4 h-4" />} label="Import" onClick={handleImport} />
        </div>
      </div>
      {status && <p className="text-sm text-ink-muted">{status}</p>}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Student" : "Add Student"}</h3>
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
          <input className="input" placeholder="Admission No" value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} />
          <input className="input" placeholder="Roll No (unique per class)" value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} />
          <input className="input" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className="input" placeholder="Father Name" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />

          <select className="input" value={form.class} onChange={(e) => handleClassChange(e.target.value)}>
            <option value="">Class</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input" value={form.section} onChange={(e) => handleSectionChange(e.target.value)} disabled={!form.class}>
            <option value="">{form.class ? "Section" : "Select class first"}</option>
            {availableSections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Admission Date</span>
            <input className="input" type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Monthly Fee (Rs.)</span>
            <input className="input" type="number" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
          </label>

          <input className="input" placeholder="Student Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Parent Mobile" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
          <input className="input" placeholder="Parent Email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} />
        </div>

        {classNames.length === 0 && (
          <p className="text-xs text-warn">No classes defined yet — add classes (and their sections) in the Classes tab first so they show up here.</p>
        )}
        {form.class && availableSections.length === 0 && (
          <p className="text-xs text-warn">"{form.class}" has no sections yet — add one in the Classes tab.</p>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <ShieldAlert className="w-4 h-4" /> {error}
          </div>
        )}

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Student" : "Add Student"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="input pl-9"
            placeholder="Search by name, admission no, roll no, or father's name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
            <tr>
              <Th>Adm. No</Th><Th>Roll No</Th><Th>Name</Th><Th>Father</Th><Th>Class</Th><Th>Section</Th>
              <Th>Admission Date</Th><Th>Parent Mobile</Th><Th>Monthly Fee</Th><Th>Dues</Th><Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-surface-raised/50">
                <Td className="font-mono text-xs">{s.admission_no}</Td>
                <Td className="font-mono text-xs">{s.roll_no}</Td>
                <Td className="font-medium">{s.full_name}</Td>
                <Td>{s.father_name}</Td>
                <Td>{s.class}</Td>
                <Td>{s.section}</Td>
                <Td>{s.admission_date}</Td>
                <Td>{s.parent_phone}</Td>
                <Td>Rs. {(s.monthly_fee ?? 0).toLocaleString()}</Td>
                <Td className={duesByStudent[s.id] > 0 ? "text-danger font-medium" : ""}>
                  Rs. {(duesByStudent[s.id] ?? 0).toLocaleString()}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openFeeHistory(s)} className="text-ink-muted hover:text-accent" title="View Fee History">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openIDCard(s)} className="text-ink-muted hover:text-accent" title="Print ID Card">
                      <CreditCard className="w-4 h-4" />
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
                <td colSpan={11} className="text-center text-ink-muted py-8">
                  {students.length === 0 ? "No students yet — add one above or import a spreadsheet." : "No students match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {idCardFor && <IDCardModal data={idCardFor} onClose={() => setIdCardFor(null)} />}

      {feeHistoryFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Fee History — {feeHistoryFor.student.full_name}</h3>
              <button onClick={() => setFeeHistoryFor(null)} className="text-ink-muted hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Month</th>
                    <th className="text-left font-medium px-3 py-2">Fee Head</th>
                    <th className="text-left font-medium px-3 py-2">Net</th>
                    <th className="text-left font-medium px-3 py-2">Paid</th>
                    <th className="text-left font-medium px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {feeHistoryFor.fees.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2">{f.month}</td>
                      <td className="px-3 py-2">{f.fee_head}</td>
                      <td className="px-3 py-2">Rs. {f.net_amount.toLocaleString()}</td>
                      <td className="px-3 py-2">Rs. {f.paid_amount.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                            f.status === "paid" ? "bg-accent-soft text-accent" : f.status === "partial" ? "bg-warn/15 text-warn" : "bg-danger/15 text-danger"
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {feeHistoryFor.fees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-ink-muted py-6">No fee records for this student yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface transition"
    >
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
