import { open } from "@tauri-apps/plugin-shell";

/**
 * Normalizes a locally-entered phone number into the digits-only international
 * format WhatsApp links require (e.g. "0300-1234567" -> "923001234567").
 * Defaults to Pakistan's country code (92) since this app is built for PKR-based
 * schools — if a number is already in full international format, it's left as-is.
 * Returns null if the input doesn't look like a usable phone number at all.
 */
export function normalizePhoneForWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("92")) return digits;          // already has country code
  if (digits.startsWith("0")) return "92" + digits.slice(1); // local format: 0300... -> 92300...
  if (digits.length >= 10) return digits;               // assume it already includes some country code
  return null; // too short to be a real number
}

export interface ReminderVars {
  school: string;
  student: string;
  amount: string; // pre-formatted, e.g. "5,000"
  month: string;
}

export const DEFAULT_REMINDER_TEMPLATE =
  "Dear Parent, this is a reminder that {student}'s school fee of Rs. {amount} for {month} is still pending. Kindly pay at your earliest convenience. Thank you. - {school}";

export function buildReminderMessage(template: string, vars: ReminderVars): string {
  return template
    .replaceAll("{school}", vars.school)
    .replaceAll("{student}", vars.student)
    .replaceAll("{amount}", vars.amount)
    .replaceAll("{month}", vars.month);
}

/** Opens WhatsApp Desktop directly via its registered OS protocol handler, if installed. */
export async function openWhatsAppDesktop(phone: string, message: string): Promise<void> {
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  await open(url);
}

/** Opens the wa.me click-to-chat link in the system's default browser (WhatsApp Web or a redirect prompt). */
export async function openWhatsAppWeb(phone: string, message: string): Promise<void> {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  await open(url);
}
