import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";

export interface Student {
  id: number;
  admission_no: string;
  roll_no: string;
  full_name: string;
  father_name: string;
  class: string;
  section: string;
  gender: string;
  dob: string;
  phone: string;
  parent_phone: string;
  parent_email: string;
  address: string;
  admission_date: string;
  monthly_fee: number;
  photo: string; // base64 data URL, "" if none uploaded
  status: string;
  created_at: string;
}

export interface Teacher {
  id: number;
  full_name: string;
  subjects: string[];
  phone: string;
  email: string;
  city: string;
  address: string;
  joining_date: string;
  status: string;
  base_salary: number;
  photo: string; // base64 data URL, "" if none uploaded
  created_at: string;
}

export interface ClassRow {
  id: number;
  name: string;
  section: string;
  teacher_ids: number[];
  default_monthly_fee: number; // pre-fills a new student's Monthly Fee when added to this class/section
  created_at: string;
}

export interface Fee {
  id: number;
  student_id: number;
  fee_head: string;
  month: string;
  amount: number;          // base amount before discount
  discount: number;        // discount value entered
  discount_type: "flat" | "percent";
  net_amount: number;      // computed: amount minus discount
  paid_amount: number;
  paid_date: string | null;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface FeeHead {
  id: number;
  name: string;
  default_amount: number;
  is_monthly: boolean;      // if true, "Generate Monthly Fees" creates a record for every active student
  use_student_fee: boolean; // if true, uses each student's own Monthly Fee field instead of default_amount
  created_at: string;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  paid_to: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

export interface AttendanceRow {
  id: number;
  student_id: number;
  date: string;
  status: "present" | "absent" | "leave";
  created_at: string;
}

export interface TeacherAttendanceRow {
  id: number;
  teacher_id: number;
  date: string;
  status: "present" | "absent" | "leave";
  created_at: string;
}

export interface Salary {
  id: number;
  teacher_id: number;
  month: string;           // e.g. "2026-07"
  base_salary: number;
  unpaid_days: number;     // absent/leave days counted from teacher_attendance for this month
  deduction: number;
  net_salary: number;      // amount owed after deduction
  paid_amount: number;     // amount actually paid so far — supports partial payment, top-up later
  status: "unpaid" | "partial" | "paid";
  paid_date: string | null;
  payment_method: string;
  linked_expense_id: number | null; // the Expenses row this salary auto-created, if anything has been paid
  created_at: string;
}

export interface SchoolProfile {
  name: string;
  address: string;
  phone: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Payroll / Salaries",
  "Utilities",
  "Rent",
  "Maintenance",
  "Supplies",
  "Marketing",
  "Other",
];

export interface AppData {
  students: Student[];
  teachers: Teacher[];
  classes: ClassRow[];
  fees: Fee[];
  attendance: AttendanceRow[];
  teacher_attendance: TeacherAttendanceRow[];
  fee_heads: FeeHead[];
  expenses: Expense[];
  salaries: Salary[];
  expenseCategories: string[];
  subjectsList: string[];
  classNames: string[];
  lastMonthlyFeeGeneration: string | null; // "YYYY-MM" of the last automatic monthly fee run
  schoolProfile: SchoolProfile;
  nextIds: Record<string, number>;
}

export const TABLES = [
  "students",
  "teachers",
  "classes",
  "fees",
  "attendance",
  "teacher_attendance",
  "fee_heads",
  "expenses",
  "salaries",
] as const;
export type TableName = (typeof TABLES)[number];

const DATA_FILENAME = "school-data.json";

function emptyStore(): AppData {
  return {
    students: [],
    teachers: [],
    classes: [],
    fees: [],
    attendance: [],
    teacher_attendance: [],
    fee_heads: [
      {
        id: 1,
        name: "School Fees",
        default_amount: 0,
        is_monthly: true,
        use_student_fee: true,
        created_at: new Date().toISOString(),
      },
    ],
    expenses: [],
    salaries: [],
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    subjectsList: ["English", "Mathematics", "Science", "Urdu", "Islamiyat", "Social Studies", "Computer"],
    classNames: [],
    lastMonthlyFeeGeneration: null,
    schoolProfile: { name: "", address: "", phone: "" },
    nextIds: {
      students: 1,
      teachers: 1,
      classes: 1,
      fees: 1,
      attendance: 1,
      teacher_attendance: 1,
      fee_heads: 2,
      expenses: 1,
      salaries: 1,
    },
  };
}

let cache: AppData | null = null;
let loadPromise: Promise<AppData> | null = null;

async function dataFilePath(): Promise<string> {
  const dir = await appLocalDataDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return join(dir, DATA_FILENAME);
}

/**
 * Backfills fields that didn't exist in older versions of the data file
 * (e.g. fee records saved before Fee Heads / discounts / net_amount existed).
 * Without this, old rows crash the UI the first time it reads a field that
 * simply isn't there yet.
 */
function migrate(data: AppData): AppData {
  data.students = data.students.map((s: any) => ({
    roll_no: "",
    parent_phone: "",
    parent_email: "",
    monthly_fee: 0,
    photo: "",
    ...s,
  }));

  data.fees = data.fees.map((f: any) => ({
    fee_head: f.fee_head ?? "General",
    discount: f.discount ?? 0,
    discount_type: f.discount_type ?? "flat",
    net_amount: f.net_amount ?? f.amount ?? 0,
    payment_method: f.payment_method ?? "Cash",
    ...f, // real values win if present; only fills in what's missing
  }));

  data.teachers = data.teachers.map((t: any) => {
    const subjects = t.subjects ?? (t.subject ? [t.subject] : []);
    const { subject, ...rest } = t; // drop the old singular field entirely
    return { base_salary: 0, city: "", address: "", photo: "", ...rest, subjects };
  });

  data.classes = data.classes.map((c: any) => {
    const teacher_ids = c.teacher_ids ?? (c.teacher_id != null ? [c.teacher_id] : []);
    const { teacher_id, ...rest } = c;
    return { default_monthly_fee: 0, ...rest, teacher_ids };
  });

  data.fee_heads = data.fee_heads.map((h: any) => ({ is_monthly: false, use_student_fee: false, ...h }));

  if (data.fee_heads.length === 0) {
    data.fee_heads = [
      { id: data.nextIds.fee_heads ?? 1, name: "School Fees", default_amount: 0, is_monthly: true, use_student_fee: true, created_at: new Date().toISOString() },
    ];
    data.nextIds.fee_heads = (data.nextIds.fee_heads ?? 1) + 1;
  }

  data.salaries = data.salaries.map((s: any) => {
    if (s.paid_amount !== undefined) return s; // already migrated
    const paid_amount = s.status === "paid" ? s.net_salary : 0;
    const status = s.status === "paid" ? "paid" : "unpaid";
    return { ...s, paid_amount, status };
  });

  // Backfill the managed class-name list from whatever class rows already exist,
  // so the new dropdown isn't empty for schools that were already using Classes.
  if (data.classNames.length === 0 && data.classes.length > 0) {
    data.classNames = [...new Set(data.classes.map((c: any) => c.name).filter(Boolean))];
  }

  // Older data files may have the pre-Payroll "Salaries" category; fold it into
  // "Payroll / Salaries" (the category Payroll auto-links to) so there's only one.
  if (data.expenseCategories.includes("Salaries") && !data.expenseCategories.includes("Payroll / Salaries")) {
    data.expenseCategories = data.expenseCategories.map((c) => (c === "Salaries" ? "Payroll / Salaries" : c));
    data.expenses = data.expenses.map((e: any) => (e.category === "Salaries" ? { ...e, category: "Payroll / Salaries" } : e));
  }

  // Guard against nextIds missing keys for tables added after a data file already existed.
  for (const table of TABLES) {
    if (typeof data.nextIds[table] !== "number" || Number.isNaN(data.nextIds[table])) {
      const rows = data[table] as any[];
      const maxId = rows.reduce((max, r) => Math.max(max, r.id ?? 0), 0);
      data.nextIds[table] = maxId + 1;
    }
  }

  return data;
}

async function load(): Promise<AppData> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const path = await dataFilePath();
    if (!(await exists(path))) {
      const fresh = emptyStore();
      await writeTextFile(path, JSON.stringify(fresh, null, 2));
      cache = fresh;
      return fresh;
    }
    try {
      const raw = await readTextFile(path);
      const parsed = migrate({ ...emptyStore(), ...JSON.parse(raw) });
      cache = parsed;
      await persist(); // write the migrated shape back so this only ever runs once
      return parsed;
    } catch {
      // Corrupt file — don't wipe the user's data file, but don't crash either.
      const fresh = emptyStore();
      cache = fresh;
      return fresh;
    }
  })();

  return loadPromise;
}

async function persist() {
  if (!cache) return;
  const path = await dataFilePath();
  await writeTextFile(path, JSON.stringify(cache, null, 2));
}

/** Returns a shallow copy of every row in a table. */
export async function getAll<T = any>(table: TableName): Promise<T[]> {
  const store = await load();
  return [...(store[table] as any[])] as T[];
}

/** Direct access to the whole store — used for cross-table joins/aggregations (Fees, Attendance, Dashboard). */
export async function getStore(): Promise<AppData> {
  return load();
}

/** Suggests the next sequential admission number in the ADM-SC-XXXXXX format. Owner can still edit it. */
export async function suggestNextAdmissionNo(): Promise<string> {
  const store = await load();
  let maxSeq = 0;
  for (const s of store.students) {
    const match = /ADM-SC-(\d+)$/i.exec((s.admission_no || "").trim());
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  return `ADM-SC-${String(maxSeq + 1).padStart(6, "0")}`;
}

/** Admission numbers must be unique regardless of whether they were auto-suggested or typed by the owner. */
export async function isAdmissionNoTaken(admissionNo: string, excludeId?: number): Promise<boolean> {
  const store = await load();
  const normalized = admissionNo.trim().toLowerCase();
  if (!normalized) return false;
  return store.students.some((s) => s.id !== excludeId && s.admission_no.trim().toLowerCase() === normalized);
}

/**
 * Roll numbers only need to be unique WITHIN the same class (e.g. "Roll 1" can exist in
 * both Grade 5-A and Grade 6-B) — unlike admission numbers, which are unique school-wide.
 */
export async function isRollNoTaken(rollNo: string, className: string, excludeId?: number): Promise<boolean> {
  const store = await load();
  const normalized = rollNo.trim().toLowerCase();
  if (!normalized) return false;
  return store.students.some(
    (s) => s.id !== excludeId && s.class === className && s.roll_no.trim().toLowerCase() === normalized
  );
}

export async function insertRow<T extends Record<string, any>>(
  table: TableName,
  row: Omit<T, "id" | "created_at">
): Promise<number> {
  const store = await load();
  const id = store.nextIds[table]++;
  const fullRow = { id, created_at: new Date().toISOString(), ...row };
  (store[table] as any[]).push(fullRow);
  await persist();
  return id;
}

export async function updateRow(table: TableName, id: number, patch: Record<string, any>): Promise<void> {
  const store = await load();
  const list = store[table] as any[];
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  await persist();
}

export async function deleteRow(table: TableName, id: number): Promise<void> {
  const store = await load();
  (store[table] as any[]) = (store[table] as any[]).filter((r) => r.id !== id);
  await persist();
}

/** Insert-or-update by a matching predicate (used by Attendance's per-day upsert). */
export async function upsertRow<T extends Record<string, any>>(
  table: TableName,
  match: (row: T) => boolean,
  row: Omit<T, "id" | "created_at">
): Promise<void> {
  const store = await load();
  const list = store[table] as any[];
  const idx = list.findIndex(match);
  if (idx === -1) {
    const id = store.nextIds[table]++;
    list.push({ id, created_at: new Date().toISOString(), ...row });
  } else {
    list[idx] = { ...list[idx], ...row };
  }
  await persist();
}

/** Wholesale replace (used by backup restore). Caller is responsible for confirming with the user first. */
export async function replaceAll(data: Partial<AppData>): Promise<void> {
  const fresh = { ...emptyStore(), ...data };
  cache = fresh;
  await persist();
}

export async function getSchoolProfile(): Promise<SchoolProfile> {
  const store = await load();
  return { ...store.schoolProfile };
}

export async function setSchoolProfile(profile: SchoolProfile): Promise<void> {
  const store = await load();
  store.schoolProfile = profile;
  await persist();
}

export async function getExpenseCategories(): Promise<string[]> {
  const store = await load();
  return [...store.expenseCategories];
}

export async function addExpenseCategory(name: string): Promise<void> {
  const store = await load();
  if (!store.expenseCategories.includes(name)) {
    store.expenseCategories.push(name);
    await persist();
  }
}

export async function removeExpenseCategory(name: string): Promise<void> {
  const store = await load();
  store.expenseCategories = store.expenseCategories.filter((c) => c !== name);
  await persist();
}

export async function getSubjectsList(): Promise<string[]> {
  const store = await load();
  return [...store.subjectsList];
}

export async function addSubject(name: string): Promise<void> {
  const store = await load();
  if (!store.subjectsList.includes(name)) {
    store.subjectsList.push(name);
    await persist();
  }
}

export async function removeSubject(name: string): Promise<void> {
  const store = await load();
  store.subjectsList = store.subjectsList.filter((s) => s !== name);
  await persist();
}

export async function getClassNames(): Promise<string[]> {
  const store = await load();
  return [...store.classNames];
}

export async function addClassName(name: string): Promise<void> {
  const store = await load();
  if (!store.classNames.includes(name)) {
    store.classNames.push(name);
    await persist();
  }
}

export async function removeClassName(name: string): Promise<void> {
  const store = await load();
  store.classNames = store.classNames.filter((c) => c !== name);
  await persist();
}

export const PAYROLL_EXPENSE_CATEGORY = "Payroll / Salaries";

/**
 * Counts unpaid days (absent/leave) for a teacher in a given "YYYY-MM" month,
 * from the teacher_attendance table. This is what Payroll uses to auto-suggest
 * a deduction — the owner can still override the final numbers before saving.
 */
export async function getUnpaidDaysForTeacherMonth(teacherId: number, monthKey: string): Promise<number> {
  const store = await load();
  return store.teacher_attendance.filter(
    (a) => a.teacher_id === teacherId && a.date.slice(0, 7) === monthKey && (a.status === "absent" || a.status === "leave")
  ).length;
}

type SalaryInput = Omit<Salary, "id" | "created_at" | "linked_expense_id">;

function deriveSalaryStatus(net: number, paid: number): "unpaid" | "partial" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid >= net) return "paid";
  return "partial";
}

/**
 * Creates or updates a salary record, keeping the Expenses ledger in sync with
 * whatever has ACTUALLY been paid so far (paid_amount), not the full net salary —
 * so a partial payment shows up in Expenses as the partial amount, not the full bill:
 * - paid_amount > 0  -> creates (or updates) a linked Expenses row for that amount
 * - paid_amount == 0 -> removes any previously-linked Expenses row
 * This is the ONLY function that should be used to write to the `salaries` table —
 * never call insertRow/updateRow/deleteRow("salaries", ...) directly, or the linked
 * Expenses row can go out of sync or become orphaned.
 */
export async function saveSalary(id: number | null, input: SalaryInput): Promise<void> {
  const store = await load();
  const teacher = store.teachers.find((t) => t.id === input.teacher_id);
  const teacherName = teacher?.full_name ?? "Unknown Teacher";
  const existing = id !== null ? store.salaries.find((s) => s.id === id) : undefined;

  let linkedExpenseId: number | null = existing?.linked_expense_id ?? null;
  const linkedExpenseStillExists = linkedExpenseId != null && store.expenses.some((e) => e.id === linkedExpenseId);

  if (input.paid_amount > 0) {
    const expenseRow = {
      date: input.paid_date ?? new Date().toISOString().slice(0, 10),
      category: PAYROLL_EXPENSE_CATEGORY,
      amount: input.paid_amount,
      paid_to: teacherName,
      payment_method: input.payment_method,
      notes: `Salary for ${input.month}${input.status === "partial" ? " (partial)" : ""}`,
    };
    if (linkedExpenseId != null && linkedExpenseStillExists) {
      await updateRow("expenses", linkedExpenseId, expenseRow);
    } else {
      linkedExpenseId = await insertRow("expenses", expenseRow);
    }
  } else if (linkedExpenseId != null) {
    // Reverted to fully unpaid — the expense should no longer exist.
    if (linkedExpenseStillExists) await deleteRow("expenses", linkedExpenseId);
    linkedExpenseId = null;
  }

  const row = { ...input, linked_expense_id: linkedExpenseId };
  if (id !== null) {
    await updateRow("salaries", id, row);
  } else {
    await insertRow("salaries", row);
  }
}

/**
 * Adds a payment to an existing salary record — for when a teacher was paid partially
 * and is now being paid the remainder. Keeps one salary record per teacher/month
 * instead of creating a second record for the same month (which isTeacherPaidForMonth
 * guards against when processing a brand-new record).
 */
export async function recordSalaryPayment(salaryId: number, amount: number, paidDate: string, paymentMethod: string): Promise<void> {
  const store = await load();
  const salary = store.salaries.find((s) => s.id === salaryId);
  if (!salary) return;
  const newPaidAmount = salary.paid_amount + amount;
  await saveSalary(salaryId, {
    teacher_id: salary.teacher_id,
    month: salary.month,
    base_salary: salary.base_salary,
    unpaid_days: salary.unpaid_days,
    deduction: salary.deduction,
    net_salary: salary.net_salary,
    paid_amount: newPaidAmount,
    status: deriveSalaryStatus(salary.net_salary, newPaidAmount),
    paid_date: paidDate,
    payment_method: paymentMethod,
  });
}

/** Deletes a salary record AND its linked Expenses row (if any), so nothing is orphaned. */
export async function deleteSalary(id: number): Promise<void> {
  const store = await load();
  const salary = store.salaries.find((s) => s.id === id);
  if (salary?.linked_expense_id != null && store.expenses.some((e) => e.id === salary.linked_expense_id)) {
    await deleteRow("expenses", salary.linked_expense_id);
  }
  await deleteRow("salaries", id);
}

/**
 * One teacher can only have one salary record per month (partial payments top up the
 * SAME record via recordSalaryPayment instead of creating a second one). Used to block
 * accidental double-processing when starting a brand-new record for an already-handled month.
 */
export async function isTeacherPaidForMonth(teacherId: number, monthKey: string, excludeId?: number): Promise<boolean> {
  const store = await load();
  return store.salaries.some((s) => s.id !== excludeId && s.teacher_id === teacherId && s.month === monthKey);
}

/** Teachers with no fully-paid salary record for the given month — the "hasn't been paid" tracker. */
export async function getSalaryDefaultersForMonth(monthKey: string): Promise<{ teacher: Teacher; owed: number }[]> {
  const store = await load();
  const activeTeachers = store.teachers.filter((t) => t.status !== "inactive");
  const result: { teacher: Teacher; owed: number }[] = [];

  for (const teacher of activeTeachers) {
    const record = store.salaries.find((s) => s.teacher_id === teacher.id && s.month === monthKey);
    if (!record) {
      // No salary processed at all yet this month — owed defaults to their base salary.
      if (teacher.base_salary > 0) result.push({ teacher, owed: teacher.base_salary });
    } else {
      const owed = Math.max(0, record.net_salary - record.paid_amount);
      if (owed > 0) result.push({ teacher, owed });
    }
  }

  return result;
}

/**
 * Adds a payment to an existing (partial/unpaid) fee record — for when a student who
 * paid part of their fee earlier comes back to pay the remainder. Keeps one fee record
 * per student/month/head instead of creating duplicate rows for the same bill.
 */
export async function recordFeePayment(feeId: number, amount: number, paidDate: string, paymentMethod: string): Promise<void> {
  const store = await load();
  const fee = store.fees.find((f) => f.id === feeId);
  if (!fee) return;
  const newPaidAmount = fee.paid_amount + amount;
  const status = newPaidAmount <= 0 ? "unpaid" : newPaidAmount >= fee.net_amount ? "paid" : "partial";
  await updateRow("fees", feeId, { paid_amount: newPaidAmount, paid_date: paidDate, payment_method: paymentMethod, status });
}

/**
 * Creates a fee record (unpaid) for every active student who doesn't already have one
 * for the given monthly Fee Head + month — this is "monthly tuition auto-billing."
 * Safe to call repeatedly; students who already have a record for that head+month are skipped.
 */
export async function generateMonthlyFees(monthKey: string): Promise<{ created: number }> {
  const store = await load();
  const monthlyHeads = store.fee_heads.filter((h) => h.is_monthly);
  if (monthlyHeads.length === 0) return { created: 0 };

  const activeStudents = store.students.filter((s) => s.status !== "inactive");
  let created = 0;

  for (const head of monthlyHeads) {
    const existingStudentIds = new Set(
      store.fees.filter((f) => f.fee_head === head.name && f.month === monthKey).map((f) => f.student_id)
    );
    for (const student of activeStudents) {
      if (existingStudentIds.has(student.id)) continue;

      const amount = head.use_student_fee ? student.monthly_fee ?? 0 : head.default_amount;
      if (amount <= 0) continue; // nothing to bill — e.g. student has no Monthly Fee set yet

      await insertRow("fees", {
        student_id: student.id,
        fee_head: head.name,
        month: monthKey,
        amount,
        discount: 0,
        discount_type: "flat",
        net_amount: amount,
        paid_amount: 0,
        paid_date: null,
        payment_method: "Cash",
        status: "unpaid",
      });
      created++;
    }
  }

  store.lastMonthlyFeeGeneration = monthKey;
  await persist();
  return { created };
}

/** Students who don't have a fully-paid record for every monthly Fee Head in the given month. */
export async function getFeeDefaultersForMonth(monthKey: string): Promise<{ student: Student; owed: number }[]> {
  const store = await load();
  const monthlyHeadNames = new Set(store.fee_heads.filter((h) => h.is_monthly).map((h) => h.name));
  if (monthlyHeadNames.size === 0) return [];

  const activeStudents = store.students.filter((s) => s.status !== "inactive");
  const result: { student: Student; owed: number }[] = [];

  for (const student of activeStudents) {
    const monthFees = store.fees.filter(
      (f) => f.student_id === student.id && f.month === monthKey && monthlyHeadNames.has(f.fee_head)
    );
    const owed = monthFees.reduce((sum, f) => sum + Math.max(0, f.net_amount - f.paid_amount), 0);
    if (owed > 0) result.push({ student, owed });
  }

  return result;
}
