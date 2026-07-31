import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Pie, PieChart, Legend } from "recharts";
import { getStore } from "../db/db";

interface AccessLike {
  mode: string;
}

interface ClassCount {
  class: string;
  count: number;
}

interface FeeStatusCount {
  status: string;
  count: number;
}

const FEE_COLORS: Record<string, string> = {
  paid: "#A3E635",
  partial: "#F5A623",
  unpaid: "#E05252",
};

function groupCount<T>(items: T[], keyFn: (item: T) => string): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

export default function Dashboard({ access }: { access: AccessLike }) {
  const [classCounts, setClassCounts] = useState<ClassCount[]>([]);
  const [feeCounts, setFeeCounts] = useState<FeeStatusCount[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);

  useEffect(() => {
    (async () => {
      const store = await getStore();

      const classes = groupCount(store.students, (s) => (s.class?.trim() ? s.class : "Unassigned"))
        .map(({ key, count }) => ({ class: key, count }))
        .sort((a, b) => b.count - a.count);
      setClassCounts(classes);

      const fees = groupCount(store.fees, (f) => f.status).map(({ key, count }) => ({ status: key, count }));
      setFeeCounts(fees);

      setTotalStudents(store.students.length);
      setTotalTeachers(store.teachers.length);
    })();
  }, []);

  return (
    <div className="page space-y-6">
      <h2 className="font-display text-2xl font-semibold">Welcome back</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="License Status" value={access.mode === "licensed" ? "Active" : "Trial"} />
        <StatCard label="Total Students" value={String(totalStudents)} />
        <StatCard label="Total Teachers" value={String(totalTeachers)} />
        <StatCard label="Storage" value="Local — Offline Secure" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-display font-semibold mb-4">Students by Class</h3>
          {classCounts.length === 0 ? (
            <EmptyChartMessage text="Add students to see this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={classCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                <XAxis dataKey="class" stroke="rgb(var(--ink-muted))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="rgb(var(--ink-muted))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "rgb(var(--ink))" }}
                />
                <Bar dataKey="count" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-display font-semibold mb-4">Fee Status Breakdown</h3>
          {feeCounts.length === 0 ? (
            <EmptyChartMessage text="Add fee records to see this chart." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={feeCounts} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {feeCounts.map((entry) => (
                    <Cell key={entry.status} fill={FEE_COLORS[entry.status] ?? "#999"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Use the tabs above to manage students, teachers, fees, attendance, this station's license, or back up your data.
      </p>
    </div>
  );
}

function EmptyChartMessage({ text }: { text: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-ink-muted">{text}</div>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-ink-muted mb-1">{label}</div>
      <div className="font-display font-semibold text-lg">{value}</div>
    </div>
  );
}
