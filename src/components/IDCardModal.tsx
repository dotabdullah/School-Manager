import { useState } from "react";
import { X, Printer, User } from "lucide-react";

export interface IDCardData {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  name: string;
  role: "Student" | "Teacher";
  idNumber: string;    // admission no, or a teacher label
  subtitle: string;    // "Grade 5 - A" for students, subjects for teachers
  extra?: string;      // father's name (students) or phone (teachers)
  photo: string;       // base64 data URL, "" if none
}

type Design = "classic" | "vertical" | "minimal" | "bold";

const DESIGNS: { key: Design; label: string }[] = [
  { key: "classic", label: "Classic Banner" },
  { key: "vertical", label: "Vertical Portrait" },
  { key: "minimal", label: "Minimal Stripe" },
  { key: "bold", label: "Bold Diagonal" },
];

export default function IDCardModal({ data, onClose }: { data: IDCardData; onClose: () => void }) {
  const [design, setDesign] = useState<Design>("classic");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white text-black rounded-xl max-w-sm w-full overflow-hidden">
        <div className="no-print flex items-center justify-between px-4 py-3 bg-[#0B0F14]">
          <span className="text-white text-sm font-medium">ID Card Preview</span>
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

        <div className="no-print px-4 pt-4 flex flex-wrap gap-1.5">
          {DESIGNS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDesign(d.key)}
              className={`text-xs rounded-full border px-3 py-1.5 transition ${
                design === d.key ? "bg-black text-white border-black" : "border-gray-300 text-gray-600"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="receipt-print p-6 flex items-center justify-center">
          {design === "classic" && <ClassicCard data={data} />}
          {design === "vertical" && <VerticalCard data={data} />}
          {design === "minimal" && <MinimalCard data={data} />}
          {design === "bold" && <BoldCard data={data} />}
        </div>
      </div>
    </div>
  );
}

function Photo({ src, size, className = "" }: { src: string; size: number; className?: string }) {
  if (src) {
    return <img src={src} width={size} height={size} className={`object-cover ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={`flex items-center justify-center bg-gray-200 text-gray-400 ${className}`}
      style={{ width: size, height: size }}
    >
      <User style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  );
}

// --- Design 1: Classic Banner (landscape, credit-card style) ---
function ClassicCard({ data }: { data: IDCardData }) {
  return (
    <div style={{ width: 340, height: 214 }} className="relative rounded-2xl overflow-hidden shadow border border-gray-200 font-sans">
      <div style={{ background: "#0B0F14" }} className="h-16 flex items-center px-4">
        <div>
          <div className="text-white font-bold text-sm leading-tight">{data.schoolName || "School Name"}</div>
          <div className="text-[#A3E635] text-[10px] leading-tight">{data.role} ID Card</div>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 -mt-8">
        <Photo src={data.photo} size={64} className="rounded-full border-4 border-white" />
        <div className="pt-6">
          <div className="font-bold text-sm">{data.name}</div>
          <div className="text-[11px] text-gray-600">{data.subtitle}</div>
        </div>
      </div>
      <div className="px-4 mt-2 text-[10px] text-gray-600 space-y-0.5">
        <div>ID: <span className="font-mono">{data.idNumber}</span></div>
        {data.extra && <div>{data.extra}</div>}
      </div>
      <div style={{ background: "#A3E635" }} className="absolute bottom-0 left-0 right-0 h-2" />
    </div>
  );
}

// --- Design 2: Vertical Portrait (badge/lanyard style) ---
function VerticalCard({ data }: { data: IDCardData }) {
  return (
    <div style={{ width: 214, height: 340 }} className="rounded-2xl overflow-hidden shadow border border-gray-200 font-sans flex flex-col">
      <div style={{ background: "#0B0F14" }} className="text-center py-3">
        <div className="text-white font-bold text-xs">{data.schoolName || "School Name"}</div>
        <div className="text-[#A3E635] text-[9px]">{data.role} ID Card</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-white py-3">
        <Photo src={data.photo} size={96} className="rounded-2xl border-2 border-gray-200" />
        <div className="text-center px-3">
          <div className="font-bold text-sm">{data.name}</div>
          <div className="text-[11px] text-gray-600">{data.subtitle}</div>
        </div>
      </div>
      <div style={{ background: "#0B0F14" }} className="text-center py-2 text-[10px] text-white">
        ID: <span className="font-mono text-[#A3E635]">{data.idNumber}</span>
      </div>
    </div>
  );
}

// --- Design 3: Minimal Stripe (landscape, clean) ---
function MinimalCard({ data }: { data: IDCardData }) {
  return (
    <div style={{ width: 340, height: 214 }} className="rounded-2xl overflow-hidden shadow border border-gray-200 font-sans flex bg-white">
      <div style={{ background: "#A3E635" }} className="w-3" />
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">{data.schoolName || "School Name"}</div>
          <div className="text-[9px] text-gray-400">{data.role} Identity Card</div>
        </div>
        <div className="flex items-center gap-3">
          <Photo src={data.photo} size={56} className="rounded-lg border border-gray-200" />
          <div>
            <div className="font-bold text-sm">{data.name}</div>
            <div className="text-[11px] text-gray-600">{data.subtitle}</div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{data.idNumber}</div>
          </div>
        </div>
        {data.extra && <div className="text-[9px] text-gray-500">{data.extra}</div>}
      </div>
    </div>
  );
}

// --- Design 4: Bold Diagonal (portrait, high contrast) ---
function BoldCard({ data }: { data: IDCardData }) {
  return (
    <div
      style={{
        width: 214,
        height: 340,
        background: "linear-gradient(135deg, #0B0F14 45%, #A3E635 45%)",
      }}
      className="rounded-2xl overflow-hidden shadow border border-gray-200 font-sans relative"
    >
      <div className="absolute top-4 left-0 right-0 text-center">
        <div className="text-white font-bold text-xs px-4">{data.schoolName || "School Name"}</div>
        <div className="text-white/70 text-[9px]">{data.role} ID Card</div>
      </div>
      <div className="absolute top-16 left-0 right-0 flex justify-center">
        <Photo src={data.photo} size={100} className="rounded-full border-4 border-white" />
      </div>
      <div className="absolute bottom-6 left-0 right-0 text-center px-4">
        <div className="font-bold text-black text-sm">{data.name}</div>
        <div className="text-[11px] text-black/70">{data.subtitle}</div>
        <div className="text-[10px] text-black/70 font-mono mt-1">{data.idNumber}</div>
      </div>
    </div>
  );
}
