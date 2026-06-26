import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (later classes win on conflict). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
