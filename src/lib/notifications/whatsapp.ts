/**
 * WhatsApp transport seam (Feature A.7 — WhatsApp Business Cloud API).
 *
 * Sends through WhatsApp Business when encrypted NEYO Ops Integration Credential
 * Vault has `whatsapp_business_token` + `whatsapp_phone_number_id` (or env
 * fallback). In local/dev without credentials, logs to console so cascade flows
 * remain testable.
 */
import { db } from "@/lib/db";
import { readCompanySecret } from "@/lib/services/company-secret.service";

export interface SendWhatsAppResult {
  ok: boolean;
  provider: "dev-console" | "whatsapp-business";
  messageId?: string;
}

export interface SendWhatsAppOptions {
  tenantId?: string;
  schoolName?: string;
  prefix?: boolean;
}

export async function getWhatsAppConfig() {
  const token = (await readCompanySecret("whatsapp_business_token")) || process.env.WHATSAPP_TOKEN || "";
  const phoneNumberId = (await readCompanySecret("whatsapp_phone_number_id")) || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const apiVersion = (await readCompanySecret("whatsapp_api_version")) || process.env.WHATSAPP_API_VERSION || "v20.0";
  return { token, phoneNumberId, apiVersion, configured: Boolean(token && phoneNumberId) };
}

async function messageWithSchoolName(message: string, options?: SendWhatsAppOptions) {
  if (options?.prefix === false) return message;
  let name = options?.schoolName?.trim() || "";
  if (!name && options?.tenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: options.tenantId }, select: { name: true } }).catch(() => null);
    name = tenant?.name || "";
  }
  if (!name) return message;
  const lower = message.toLowerCase();
  if (lower.startsWith(`${name.toLowerCase()}:`) || lower.startsWith("neyo:")) return message;
  return `${name}: ${message}`;
}

function waPhone(to: string) {
  const digits = to.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export async function sendWhatsApp(
  to: string,
  message: string,
  options?: SendWhatsAppOptions
): Promise<SendWhatsAppResult> {
  const finalMessage = await messageWithSchoolName(message, options);
  const config = await getWhatsAppConfig();

  if (!config.configured) {
    console.log(`\n[WHATSAPP → ${to}]\n${finalMessage}\n`);
    return { ok: process.env.NODE_ENV !== "production", provider: "dev-console" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: waPhone(to),
        type: "text",
        text: { preview_url: false, body: finalMessage },
      }),
    });
    const json = await res.json().catch(() => ({} as any));
    const id = json?.messages?.[0]?.id;
    return { ok: res.ok, provider: "whatsapp-business", messageId: id };
  } catch {
    return { ok: false, provider: "whatsapp-business" };
  }
}

export const WHATSAPP_CONFIGURED = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
