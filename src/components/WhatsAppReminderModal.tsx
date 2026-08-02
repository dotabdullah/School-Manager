import { useState } from "react";
import { X, MessageCircle, Monitor, Globe, Copy, Check, ShieldAlert } from "lucide-react";
import {
  normalizePhoneForWhatsApp,
  buildReminderMessage,
  openWhatsAppDesktop,
  openWhatsAppWeb,
  DEFAULT_REMINDER_TEMPLATE,
} from "../lib/whatsapp";

export default function WhatsAppReminderModal({
  studentName,
  parentPhone,
  amount,
  month,
  schoolName,
  template,
  onClose,
}: {
  studentName: string;
  parentPhone: string;
  amount: number;
  month: string;
  schoolName: string;
  template: string;
  onClose: () => void;
}) {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const phone = normalizePhoneForWhatsApp(parentPhone);
  const message = buildReminderMessage(template || DEFAULT_REMINDER_TEMPLATE, {
    school: schoolName || "the school",
    student: studentName,
    amount: amount.toLocaleString(),
    month,
  });

  function copyMessage() {
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  }
  function copyPhone() {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="card max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-accent" />
            <h3 className="font-medium text-sm">WhatsApp Fee Reminder — {studentName}</h3>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!phone ? (
          <div className="flex items-center gap-2 text-sm text-danger">
            <ShieldAlert className="w-4 h-4" />
            No usable parent phone number on file for this student — add one on the Students page first.
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Sending to <span className="font-mono">+{phone}</span>
          </p>
        )}

        <div className="rounded-lg bg-surface-raised border border-border p-3 text-sm whitespace-pre-wrap">{message}</div>

        {phone && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openWhatsAppDesktop(phone, message)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent text-black font-medium px-3 py-2 text-sm hover:opacity-90 transition"
            >
              <Monitor className="w-4 h-4" /> WhatsApp Desktop
            </button>
            <button
              onClick={() => openWhatsAppWeb(phone, message)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-raised transition"
            >
              <Globe className="w-4 h-4" /> WhatsApp Web
            </button>
          </div>
        )}

        <p className="text-xs text-ink-muted">
          If neither button opens WhatsApp on this PC (e.g. it's not installed, or isn't set as the
          default handler), copy the message and number below and send it manually instead.
        </p>

        <div className="flex gap-2">
          <button onClick={copyMessage} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm rounded-lg border border-border px-3 py-2 hover:bg-surface-raised transition">
            {copiedMessage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedMessage ? "Copied" : "Copy Message"}
          </button>
          {phone && (
            <button onClick={copyPhone} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm rounded-lg border border-border px-3 py-2 hover:bg-surface-raised transition">
              {copiedPhone ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedPhone ? "Copied" : "Copy Number"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
