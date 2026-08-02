import { X, Printer } from "lucide-react";
import { Exam, ExamResultSummary, SchoolProfile } from "../db/db";

export interface ReportCardData {
  exam: Exam;
  studentName: string;
  admissionNo: string;
  className: string;
  section: string;
  summary: ExamResultSummary;
  remarks: string;
}

export default function ReportCardModal({
  data,
  school,
  onClose,
}: {
  data: ReportCardData;
  school: SchoolProfile;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="no-print flex items-center justify-between px-4 py-3 bg-[#0B0F14] sticky top-0">
          <span className="text-white text-sm font-medium">Report Card Preview</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs bg-[#A3E635] text-black font-medium rounded-lg px-3 py-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="receipt-print p-6 space-y-4 font-sans">
          <div className="text-center border-b-2 border-gray-800 pb-3">
            <h2 className="font-bold text-lg">{school.name || "School Name Not Set"}</h2>
            {school.address && <p className="text-xs text-gray-600">{school.address}</p>}
            {school.phone && <p className="text-xs text-gray-600">{school.phone}</p>}
            <p className="text-sm font-semibold mt-2">Report Card — {data.exam.name}</p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row label="Student Name" value={data.studentName} />
              <Row label="Admission No" value={data.admissionNo} />
              <Row label="Class" value={`${data.className} - ${data.section}`} />
              <Row label="Exam Date" value={data.exam.date} />
            </tbody>
          </table>

          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-2 py-1.5 border-b border-gray-300">Subject</th>
                <th className="text-right px-2 py-1.5 border-b border-gray-300">Obtained</th>
                <th className="text-right px-2 py-1.5 border-b border-gray-300">Max</th>
                <th className="text-center px-2 py-1.5 border-b border-gray-300">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.perSubject.map((s) => (
                <tr key={s.subject} className="border-b border-gray-200">
                  <td className="px-2 py-1.5">{s.subject}</td>
                  <td className="px-2 py-1.5 text-right">{s.obtained}</td>
                  <td className="px-2 py-1.5 text-right">{s.max}</td>
                  <td className={`px-2 py-1.5 text-center font-medium ${s.passed ? "text-green-700" : "text-red-600"}`}>
                    {s.passed ? "Pass" : "Fail"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryBox label="Total Marks" value={`${data.summary.obtained} / ${data.summary.total}`} />
            <SummaryBox label="Percentage" value={`${data.summary.percentage}%`} />
            <SummaryBox label="Grade" value={data.summary.grade} />
            <SummaryBox
              label="Overall Result"
              value={data.summary.passed ? "PASS" : "FAIL"}
              accent={data.summary.passed ? "text-green-700" : "text-red-600"}
            />
          </div>

          {data.remarks && (
            <div className="text-sm">
              <span className="text-gray-600">Remarks: </span>
              {data.remarks}
            </div>
          )}

          <div className="flex justify-between pt-8 text-xs text-gray-500">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1 w-32">Class Teacher</div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-1 w-32">Principal</div>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-200">
            This is a computer-generated report card.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-0.5 text-gray-600 w-32">{label}</td>
      <td className="py-0.5 font-medium">{value}</td>
    </tr>
  );
}

function SummaryBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-300 p-2">
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className={`font-bold text-base ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
