import { X, Printer } from "lucide-react";
import { SchoolProfile } from "../db/db";

export interface ReceiptData {
  receiptNo: string;
  studentName: string;
  studentClass: string;
  feeHead: string;
  month: string;
  amount: number;
  discount: number;
  netAmount: number;
  paidAmount: number;
  paidDate: string | null;
  paymentMethod: string;
}

export default function ReceiptModal({
  data,
  school,
  onClose,
}: {
  data: ReceiptData;
  school: SchoolProfile;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl max-w-md w-full overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 py-3 bg-[#0B0F14]">
          <span className="text-white text-sm font-medium">Receipt Preview</span>
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
            <p className="text-xs text-gray-500 mt-1">Fee Receipt</p>
          </div>

          <div className="flex justify-between text-xs text-gray-600">
            <span>Receipt No: {data.receiptNo}</span>
            <span>Date: {data.paidDate ?? "—"}</span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row label="Student" value={data.studentName} />
              <Row label="Class" value={data.studentClass || "—"} />
              <Row label="Fee Head" value={data.feeHead} />
              <Row label="Month" value={data.month} />
              <Row label="Amount" value={`Rs. ${data.amount.toLocaleString()}`} />
              {data.discount > 0 && <Row label="Discount" value={`Rs. ${data.discount.toLocaleString()}`} />}
              <Row label="Net Payable" value={`Rs. ${data.netAmount.toLocaleString()}`} bold />
              <Row label="Amount Paid" value={`Rs. ${data.paidAmount.toLocaleString()}`} bold />
              <Row label="Payment Method" value={data.paymentMethod || "—"} />
            </tbody>
          </table>

          <p className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-200">
            This is a computer-generated receipt.
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
