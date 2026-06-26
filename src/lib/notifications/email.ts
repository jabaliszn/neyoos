/**
 * Email transport seam (Feature A.7 — Resend).
 *
 * Sends through Resend when the encrypted NEYO Ops Integration Credential Vault
 * has `resend_api_key` (or env RESEND_API_KEY as fallback). In local/dev without
 * credentials, logs to console so magic links and notifications remain testable.
 */
import { readCompanySecret } from "@/lib/services/company-secret.service";

export interface SendEmailResult {
  ok: boolean;
  provider: "dev-console" | "resend";
  messageId?: string;
}

async function resendConfig() {
  const apiKey = (await readCompanySecret("resend_api_key")) || process.env.RESEND_API_KEY || "";
  const from = (await readCompanySecret("resend_from_email")) || process.env.RESEND_FROM_EMAIL || "NEYO <no-reply@neyo.co.ke>";
  return { apiKey, from };
}

function looksLikeHtml(body: string) {
  return /<\s*(html|body|div|p|br|table|strong|a)\b/i.test(body);
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const { apiKey, from } = await resendConfig();

  if (!apiKey) {
    console.log(`\n[EMAIL → ${to}]\nSubject: ${subject}\n${body}\n`);
    return { ok: process.env.NODE_ENV !== "production", provider: "dev-console", messageId: `dev_${Date.now()}` };
  }

  try {
    const payload = looksLikeHtml(body)
      ? { from, to, subject, html: body }
      : { from, to, subject, text: body };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, provider: "resend", messageId: json?.id };
    return { ok: true, provider: "resend", messageId: json?.id || `resend_${Date.now()}` };
  } catch {
    return { ok: false, provider: "resend" };
  }
}

/** G.8 Polish — Generate HTML email template with native dark-mode styling and G.9 brand primary colors. */
export function buildBrandedEmailHtml(tenant: { name: string; brandPrimary?: string | null; motto?: string | null }, subject: string, bodyHtml: string): string {
  const brandColor = tenant.brandPrimary || "#1c2740";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { background-color: #fafafb; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background-color: ${brandColor}; padding: 24px; color: #ffffff; text-align: center; }
    .school-name { font-size: 20px; font-weight: 700; margin: 0; }
    .school-motto { font-size: 11px; color: #1f9d5f; font-style: italic; margin-top: 4px; }
    .content { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .footer { background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
    .powered { margin-top: 4px; font-weight: 600; }
    @media (prefers-color-scheme: dark) { body { background-color: #0f172a; color: #f1f5f9; } .wrapper { background-color: #1e293b; border-color: #334155; } .content { color: #e2e8f0; } .footer { background-color: #0f172a; border-top-color: #334155; color: #94a3b8; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="school-name">${tenant.name}</div>
      ${tenant.motto ? `<div class="school-motto">${tenant.motto}</div>` : ""}
    </div>
    <div class="content">${bodyHtml}</div>
    <div class="footer">
      <div>This is an official administrative transmission from ${tenant.name}.</div>
      <div class="powered">Powered by NEYO · neyo.co.ke</div>
    </div>
  </div>
</body>
</html>`;
}

/** In development we surface the magic link to the caller so it can be tested. */
export const SHOW_DEV_LINK = process.env.NODE_ENV !== "production";

/** Base URL for building absolute links in emails. */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}
