/**
 * QR helper (Feature A.10 — QR verification on important docs).
 * Returns a PNG data-URL suitable for embedding in a PDF or page.
 */
import QRCode from "qrcode";
import { appBaseUrl } from "@/lib/notifications/email";

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 140 });
}

/** Full public verification URL for a document code. */
export function verifyUrl(code: string): string {
  return `${appBaseUrl()}/verify/${code}`;
}
