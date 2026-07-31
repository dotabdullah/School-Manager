import { useEffect, useMemo, useState } from "react";
import { Save, CheckCircle2, XCircle, Clock, Users, GraduationCap, History, ClipboardList } from "lucide-react";
import { getAll, getStore, upsertRow, getClassNames } from "../db/db";

interface Person {
  id: number;
  full_name: string;
  subtitle: string; // class (students) or subjects (teachers)
}

type AttendanceStatus = "present" | "absent" | "leave";
type Mode = "students" | "teachers";
type View = "mark" | "history";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function Attendance() {
  const [mode, setMode] = useState<Mode>("students");
  const [view, setView] = useState<View>("mark");
  const [people, setPeople] = useState<Person[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [status, setStatus] = useState("");

  const [fromDate, setFromDate] = useState(daysAgoISO(7));
  const [toDate, setToDate] = useState(todayISO());
  const [historyRows, setHistoryRows] = useState<{ personName: string; date: string; status: AttendanceStatus }[]>([]);

  const table = mode === "students" ? "attendance" : "teacher_attendance";
  const idField = mode === "students" ? "student_id" : "teacher_id";
  const personLabel = mode === "students" ? "Student" : "Teacher";

  async function loadForDate(forMode: Mode, forDate: string, forClass: string) {
    let list: Person[];
    if (forMode === "students") {
      const students = await getAll<{ id: number; full_name: string; class: string }>("students");
      list = students
        .filter((s) => !forClass || s.class === forClass)
        .map((s) => ({ id: s.id, full_name: s.full_name, subtitle: s.class }));
    } else {
      const teachers = await getAll<{ id: number; full_name: string; subjects: string[] }>("teachers");
      list = teachers.map((t) => ({ id: t.id, full_name: t.full_name, subtitle: (t.subjects ?? []).join(", ") }));
    }
    setPeople(list);

    const store = await getStore();
    const rows = forMode === "students" ? store.attendance : store.teacher_attendance;
    const existing = rows.filter((a: any) => a.date === forDate);
    const map: Record<number, AttendanceStatus> = {};
    for (const p of list) map[p.id] = "present";
    for (const row of existing as any[]) {
      const personId = forMode === "students" ? row.student_id : row.teacher_id;
      map[personId] = row.status;
    }
    setMarks(map);
  }

  async function loadHistory() {
    const store = await getStore();
    const rows = mode === "students" ? store.attendance : store.teacher_attendance;
    const nameById = new Map(
      mode === "students" ? store.students.map((s) => [s.id, s.full_name]) : store.teachers.map((t) => [t.id, t.full_name])
    );
    const filteredRows = (rows as any[])
      .filter((r) => r.date >= fromDate && r.date <= toDate)
      .filter((r) => mode !== "students" || !classFilter || store.students.find((s) => s.id === r.student_id)?.class === classFilter)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => ({
        personName: nameById.get(mode === "students" ? r.student_id : r.teacher_id) ?? "(unknown)",
        date: r.date,
        status: r.status as AttendanceStatus,
      }));
    setHistoryRows(filteredRows);
  }

  useEffect(() => {
    getClassNames().then(setClassNames);
  }, []);

  useEffect(() => {
    if (view === "mark") loadForDate(mode, date, classFilter);
    else loadHistory();
    setStatus("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, date, classFilter, view, fromDate, toDate]);

  function setMark(personId: number, value: AttendanceStatus) {
    setMarks((prev) => ({ ...prev, [personId]: value }));
  }

  async function handleSave() {
    setStatus("Saving…");
    for (const p of people) {
      await upsertRow(table, (row: any) => row[idField] === p.id && row.date === date, { [idField]: p.id, date, status: marks[p.id] ?? "present" });
    }
    setStatus(`Saved ${mode} attendance for ${date}.`);
  }

  const presentCount = Object.values(marks).filter((m) => m === "present").length;

  const historySummary = useMemo(() => {
    const present = historyRows.filter((r) => r.status === "present").length;
    const absent = historyRows.filter((r) => r.status === "absent").length;
    const leave = historyRows.filter((r) => r.status === "leave").length;
    return { present, absent, leave };
  }, [historyRows]);

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-2xl font-semibold">Attendance</h2>
        <div className="inline-flex rounded-lg border border-border p-1 bg-surface-raised">
          <ModeButton icon={<ClipboardList className="w-3.5 h-3.5" />} label="Mark" active={view === "mark"} onClick={() => setView("mark")} />
          <ModeButton icon={<History className="w-3.5 h-3.5" />} label="History" active={view === "history"} onClick={() => setView("history")} />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-border p-1 bg-surface-raised">
          <ModeButton icon={<Users className="w-3.5 h-3.5" />} label="Students" active={mode === "students"} onClick={() => setMode("students")} />
          <ModeButton icon={<GraduationCap className="w-3.5 h-3.5" />} label="Teachers" active={mode === "teachers"} onClick={() => setMode("teachers")} />
        </div>

        {mode === "students" && (
          <select className="input w-auto" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {view === "mark" ? (
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" className="input w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="text-ink-muted text-sm">to</span>
            <input type="date" className="input w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        )}
      </div>

      {view === "mark" ? (
        <>
          <div className="card flex items-center gap-6">
            <Stat label={`Total ${personLabel}s`} value={people.length} />
            <Stat label="Marked Present" value={presentCount} accent />
            <Stat label="Marked Absent/Leave" value={people.length - presentCount} />
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3">{personLabel}</th>
                  <th className="text-left font-medium px-4 py-3">{mode === "students" ? "Class" : "Subjects"}</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-raised/50">
                    <td className="px-4 py-3 font-medium">{p.full_name}</td>
                    <td className="px-4 py-3">{p.subtitle}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <StatusButton icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Present" active={marks[p.id] === "present"} onClick={() => setMark(p.id, "present")} />
                        <StatusButton icon={<XCircle className="w-3.5 h-3.5" />} label="Absent" active={marks[p.id] === "absent"} onClick={() => setMark(p.id, "absent")} />
                        <StatusButton icon={<Clock className="w-3.5 h-3.5" />} label="Leave" active={marks[p.id] === "leave"} onClick={() => setMark(p.id, "leave")} />
                      </div>
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-ink-muted py-8">
                      No {mode} {mode === "students" && classFilter ? `in ${classFilter}` : "yet"}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {mode === "teachers" && (
            <p className="text-xs text-ink-muted">
              Payroll deducts salary for days marked Absent or Leave here. Mark attendance for every
              payroll month before processing that teacher's salary.
            </p>
          )}

          {people.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-black font-semibold px-5 py-2.5 text-sm hover:opacity-90 transition"
              >
                <Save className="w-4 h-4" /> Save Attendance
              </button>
              {status && <span className="text-sm text-ink-muted">{status}</span>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card flex items-center gap-6">
            <Stat label="Present" value={historySummary.present} accent />
            <Stat label="Absent" value={historySummary.absent} />
            <Stat label="Leave" value={historySummary.leave} />
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-ink-muted text-xs uppercase">
                <tr>
                  <th className="text-left font-medium px-4 py-3">{personLabel}</th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyRows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-raised/50">
                    <td className="px-4 py-3 font-medium">{r.personName}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <HistoryPill status={r.status} />
                    </td>
                  </tr>
                ))}
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-ink-muted py-8">
                      No attendance records in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ModeButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-accent text-black" : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`font-display font-semibold text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function StatusButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
        active ? "bg-accent-soft border-accent/30 text-accent" : "border-border text-ink-muted hover:bg-surface-raised"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function HistoryPill({ status }: { status: AttendanceStatus }) {
  const styles: Record<AttendanceStatus, string> = {
    present: "bg-accent-soft text-accent",
    absent: "bg-danger/15 text-danger",
    leave: "bg-warn/15 text-warn",
  };
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${styles[status]}`}>{status}</span>;
}
