import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Search, ArrowLeft, Save, Printer, GraduationCap, ClipboardList } from "lucide-react";
import {
  getAll,
  insertRow,
  updateRow,
  deleteRow,
  getStore,
  upsertRow,
  getSubjectsList,
  getClassNames,
  getSchoolProfile,
  summarizeExamResult,
  Exam,
  ExamSubjectConfig,
  Student,
  SchoolProfile,
} from "../db/db";
import ReportCardModal, { ReportCardData } from "../components/ReportCardModal";

const emptyForm = { name: "", class: "", date: new Date().toISOString().slice(0, 10) };

export default function Exams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formSubjects, setFormSubjects] = useState<ExamSubjectConfig[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  async function refresh() {
    setExams(await getAll<Exam>("exams"));
    setClassNames(await getClassNames());
    setSubjectsList(await getSubjectsList());
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSubject(subject: string) {
    setFormSubjects((prev) =>
      prev.some((s) => s.subject === subject)
        ? prev.filter((s) => s.subject !== subject)
        : [...prev, { subject, maxMarks: 100, passMarks: 33 }]
    );
  }

  function updateSubjectConfig(subject: string, field: "maxMarks" | "passMarks", value: number) {
    setFormSubjects((prev) => prev.map((s) => (s.subject === subject ? { ...s, [field]: value } : s)));
  }

  function startEdit(e: Exam) {
    setEditingId(e.id);
    setForm({ name: e.name, class: e.class, date: e.date });
    setFormSubjects(e.subjects);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFormSubjects([]);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.class || formSubjects.length === 0) return;
    const row = { name: form.name.trim(), class: form.class, date: form.date, subjects: formSubjects };
    if (editingId !== null) {
      await updateRow("exams", editingId, row);
      setEditingId(null);
    } else {
      await insertRow("exams", row);
    }
    setForm(emptyForm);
    setFormSubjects([]);
    refresh();
  }

  async function handleDelete(id: number) {
    await deleteRow("exams", id);
    if (editingId === id) cancelEdit();
    if (selectedExamId === id) setSelectedExamId(null);
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((e) => e.name.toLowerCase().includes(q) || e.class.toLowerCase().includes(q));
  }, [exams, search]);

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;

  if (selectedExam) {
    return <MarksAndResults exam={selectedExam} onBack={() => setSelectedExamId(null)} />;
  }

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Exams &amp; Results</h2>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{editingId !== null ? "Edit Exam" : "Create Exam"}</h3>
          {editingId !== null && (
            <button onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
              <X className="w-3.5 h-3.5" /> Cancel Edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className="input" placeholder="Exam Name (e.g. Mid Term 2026)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
            <option value="">Select Class</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>

        <div>
          <div className="text-xs text-ink-muted mb-2">Subjects (select, then set Max / Pass marks for each)</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {subjectsList.length === 0 && <span className="text-xs text-ink-muted">No subjects defined — add some on the Teachers page first.</span>}
            {subjectsList.map((s) => (
              <label
                key={s}
                className={`inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1.5 cursor-pointer transition ${
                  formSubjects.some((f) => f.subject === s) ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted"
                }`}
              >
                <input type="checkbox" className="hidden" checked={formSubjects.some((f) => f.subject === s)} onChange={() => toggleSubject(s)} />
                {s}
              </label>
            ))}
          </div>
          {formSubjects.length > 0 && (
            <div className="space-y-2">
              {formSubjects.map((s) => (
                <div key={s.subject} className="flex items-center gap-2 text-sm">
                  <span className="w-32 text-ink-muted">{s.subject}</span>
                  <input
                    className="input w-24"
                    type="number"
                    placeholder="Max"
                    value={s.maxMarks}
                    onChange={(e) => updateSubjectConfig(s.subject, "maxMarks", Number(e.target.value))}
                  />
                  <input
                    className="input w-24"
                    type="number"
                    placeholder="Pass"
                    value={s.passMarks}
                    onChange={(e) => updateSubjectConfig(s.subject, "passMarks", Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-medium px-4 py-2 text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> {editingId !== null ? "Update Exam" : "Create Exam"}
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input className="input pl-9" placeholder="Search by exam name or class…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-4 py-3">Exam</th>
                <th className="text-left font-medium px-4 py-3">Class</th>
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-left font-medium px-4 py-3">Subjects</th>
                <th className="text-left font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3">{e.class}</td>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3">{e.subjects.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedExamId(e.id)}
                        className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2.5 py-1.5 hover:bg-surface-raised transition"
                      >
                        <ClipboardList className="w-3.5 h-3.5" /> Marks &amp; Results
                      </button>
                      <button onClick={() => startEdit(e)} className="text-ink-muted hover:text-accent" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="text-danger hover:opacity-80" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-ink-muted py-10">
                    <GraduationCap className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    {exams.length === 0 ? "No exams yet — create one above." : "No exams match your search."}
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

function MarksAndResults({ exam, onBack }: { exam: Exam; onBack: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [marksByStudent, setMarksByStudent] = useState<Record<number, Record<string, number>>>({});
  const [remarksByStudent, setRemarksByStudent] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("");
  const [school, setSchool] = useState<SchoolProfile>({ name: "", address: "", phone: "", feeReminderTemplate: "" });
  const [reportCardFor, setReportCardFor] = useState<ReportCardData | null>(null);

  async function refresh() {
    const allStudents = await getAll<Student>("students");
    const classStudents = allStudents.filter((s) => s.class === exam.class);
    setStudents(classStudents);
    setSchool(await getSchoolProfile());

    const store = await getStore();
    const existing = store.exam_results.filter((r) => r.exam_id === exam.id);
    const marksMap: Record<number, Record<string, number>> = {};
    const remarksMap: Record<number, string> = {};
    for (const s of classStudents) marksMap[s.id] = {};
    for (const r of existing) {
      marksMap[r.student_id] = r.marks;
      remarksMap[r.student_id] = r.remarks;
    }
    setMarksByStudent(marksMap);
    setRemarksByStudent(remarksMap);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  function setMark(studentId: number, subject: string, value: number) {
    setMarksByStudent((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [subject]: value } }));
  }

  async function handleSaveAll() {
    setStatus("Saving…");
    for (const s of students) {
      await upsertRow(
        "exam_results",
        (row: any) => row.exam_id === exam.id && row.student_id === s.id,
        { exam_id: exam.id, student_id: s.id, marks: marksByStudent[s.id] ?? {}, remarks: remarksByStudent[s.id] ?? "" }
      );
    }
    setStatus("Marks saved.");
  }

  function openReportCard(s: Student) {
    const summary = summarizeExamResult(exam, marksByStudent[s.id] ?? {});
    setReportCardFor({
      exam,
      studentName: s.full_name,
      admissionNo: s.admission_no,
      className: s.class,
      section: s.section,
      summary,
      remarks: remarksByStudent[s.id] ?? "",
    });
  }

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Exams
          </button>
          <h2 className="font-display text-2xl font-semibold">{exam.name} — {exam.class}</h2>
        </div>
        <button
          onClick={handleSaveAll}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
        >
          <Save className="w-4 h-4" /> Save All Marks
        </button>
      </div>
      {status && <p className="text-sm text-ink-muted">{status}</p>}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-4 py-3 sticky left-0 bg-surface-raised">Student</th>
                {exam.subjects.map((s) => (
                  <th key={s.subject} className="text-left font-medium px-3 py-3 whitespace-nowrap">
                    {s.subject} <span className="text-[10px]">(/{s.maxMarks})</span>
                  </th>
                ))}
                <th className="text-left font-medium px-3 py-3">Total</th>
                <th className="text-left font-medium px-3 py-3">%</th>
                <th className="text-left font-medium px-3 py-3">Grade</th>
                <th className="text-left font-medium px-3 py-3">Result</th>
                <th className="text-left font-medium px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((s) => {
                const summary = summarizeExamResult(exam, marksByStudent[s.id] ?? {});
                return (
                  <tr key={s.id} className="hover:bg-surface-raised/50">
                    <td className="px-4 py-2 font-medium whitespace-nowrap sticky left-0 bg-surface">{s.full_name}</td>
                    {exam.subjects.map((subj) => (
                      <td key={subj.subject} className="px-3 py-2">
                        <input
                          type="number"
                          className="input w-20 py-1"
                          value={marksByStudent[s.id]?.[subj.subject] ?? 0}
                          onChange={(e) => setMark(s.id, subj.subject, Number(e.target.value))}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">{summary.obtained}/{summary.total}</td>
                    <td className="px-3 py-2">{summary.percentage}%</td>
                    <td className="px-3 py-2 font-medium">{summary.grade}</td>
                    <td className={`px-3 py-2 font-medium ${summary.passed ? "text-accent" : "text-danger"}`}>
                      {summary.passed ? "Pass" : "Fail"}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => openReportCard(s)} className="text-ink-muted hover:text-accent" title="Print Report Card">
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={exam.subjects.length + 5} className="text-center text-ink-muted py-8">
                    No students in {exam.class} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reportCardFor && <ReportCardModal data={reportCardFor} school={school} onClose={() => setReportCardFor(null)} />}
    </div>
  );
}
