import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (later classes win on conflict). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Kenya's Ministry of Education officially rebranded the curriculum from
 * "Competency-Based Curriculum (CBC)" to "Competency-Based Education (CBE)"
 * in April 2025. NEYO keeps the internal/stored value as "CBC" (matches
 * every existing DB row, enum, and API contract — zero data migration
 * risk), but every real user-facing label always displays "CBE" instead.
 * Use this wherever a curriculum code is rendered to a school/parent/staff
 * member; never display the raw stored code directly.
 */
export function curriculumLabel(code: string | null | undefined): string {
  if (!code) return "";
  if (code === "CBC") return "CBE";
  if (code === "BOTH") return "CBE & 8-4-4";
  return code;
}

/** Format a number as Kenyan Shillings. Always KES, never $. */
export function formatKES(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a phone number to the +254 7XX XXX XXX shape for display. */
export function formatPhoneKE(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("254")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  if (local.length !== 9) return raw; // leave untouched if not a clean KE number
  return `+254 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
