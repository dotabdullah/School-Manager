import { X, Printer } from "lucide-react";
import { SchoolProfile } from "../db/db";

export interface PayslipData {
  payslipNo: string;
  teacherName: string;
  subject: string;
  month: string;
  baseSalary: number;
  unpaidDays: number;
  deduction: number;
  netSalary: number;
  status: "pending" | "paid";
  paidDate: string | null;
  paymentMethod: string;
}

export default function PayslipModal({
  data,
  school,
  onClose,
}: {
  data: PayslipData;
  school: SchoolProfile;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl max-w-md w-full overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 py-3 bg-[#0B0F14]">
          <span className="text-white text-sm font-medium">Payslip Preview</span>
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
          <div className="text-center border-b border-gray-300 pb-3">
            <h2 className="font-bold text-lg">{school.name || "School Name Not Set"}</h2>
            {school.address && <p className="text-xs text-gray-600">{school.address}</p>}
            {school.phone && <p className="text-xs text-gray-600">{school.phone}</p>}
            <p className="text-xs text-gray-500 mt-1">Payslip</p>
          </div>

          <div className="flex justify-between text-xs text-gray-600">
            <span>Payslip No: {data.payslipNo}</span>
            <span>Month: {data.month}</span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row label="Teacher" value={data.teacherName} />
              <Row label="Subject" value={data.subject || "—"} />
              <Row label="Base Salary" value={`Rs. ${data.baseSalary.toLocaleString()}`} />
              <Row label="Unpaid Days" value={String(data.unpaidDays)} />
              <Row label="Deduction" value={`Rs. ${data.deduction.toLocaleString()}`} />
              <Row label="Net Salary" value={`Rs. ${data.netSalary.toLocaleString()}`} bold />
              <Row label="Status" value={data.status === "paid" ? "Paid" : "Pending"} bold />
              {data.status === "paid" && <Row label="Paid Date" value={data.paidDate ?? "—"} />}
              {data.status === "paid" && <Row label="Payment Method" value={data.paymentMethod || "—"} />}
            </tbody>
          </table>

          <p className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-200">
            This is a computer-generated payslip.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="py-1 text-gray-600">{label}</td>
      <td className="py-1 text-right">{value}</td>
    </tr>
  );
}
