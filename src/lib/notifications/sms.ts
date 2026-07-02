/**
 * SMS transport seam (Feature A.7 — Africa's Talking).
 *
 * Sends through Africa's Talking when encrypted NEYO Ops Integration Credential
 * Vault has `africas_talking_api_key` + `africas_talking_username` (or env
 * fallback). In local/dev without credentials, logs to console so OTP and
 * school-message flows remain testable.
 *
 * M.2 — NEYO Ops configures the buy/sell price per SMS centrally
 * (`revenue-ops.service.ts`); every real send (dev-console fallback AND the
 * live Africa's Talking path) records a real SmsMarginLedger row so NEYO's
 * SMS margin revenue is genuinely tracked, not just simulated in dev.
 */
import { db } from "@/lib/db";
import { readCompanySecret } from "@/lib/services/company-secret.service";
import { getSmsMarginConfig } from "@/lib/services/revenue-ops.service";

export interface SendSmsResult {
  ok: boolean;
  provider: "dev-console" | "africas-talking";
  messageId?: string;
}

export interface SendSmsOptions {
  /** When provided, NEYO can prefix the correct school name if caller did not. */
  tenantId?: string;
  /** Optional explicit label. tenantId lookup wins if both exist. */
  schoolName?: string;
  /** Disable automatic school/NEYO prefixing for OTPs/provider callbacks. */
  prefix?: boolean;
}

async function atConfig() {
  return {
    apiKey: (await readCompanySecret("africas_talking_api_key")) || process.env.AT_API_KEY || "",
    username: (await readCompanySecret("africas_talking_username")) || process.env.AT_USERNAME || "sandbox",
    senderId: (await readCompanySecret("africas_talking_sender_id")) || process.env.AT_SENDER_ID || "",
  };
}

async function messageWithSchoolName(message: string, options?: SendSmsOptions) {
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

/** M.2 — records ONE real margin-ledger row for a single SMS send, using the
 * live NEYO Ops-configured buy/sell prices (never a hardcoded number). */
async function recordSmsMargin(tenantId: string) {
  try {
    const { costPerSmsKes, pricePerSmsKes } = await getSmsMarginConfig();
    await db.smsMarginLedger.create({
      data: {
        tenantId,
        messageCount: 1,
        costPerSmsKes,
        pricePerSmsKes,
        marginKes: pricePerSmsKes - costPerSmsKes,
        status: "UNBILLED",
      },
    });
  } catch {
    // Margin tracking must never block an SMS from sending.
  }
}

export async function sendSms(to: string, message: string, options?: SendSmsOptions): Promise<SendSmsResult> {
  const finalMessage = await messageWithSchoolName(message, options);
  const config = await atConfig();

  if (!config.apiKey) {
    console.log(`\n[SMS → ${to}]\n${finalMessage}\n`);
    if (options?.tenantId) await recordSmsMargin(options.tenantId);
    return {
      ok: process.env.NODE_ENV !== "production",
      provider: "dev-console",
      messageId: `dev_${Date.now()}`,
    };
  }

  try {
    const params = new URLSearchParams({ username: config.username, to, message: finalMessage });
    if (config.senderId) params.set("from", config.senderId);
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: config.apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await res.json().catch(() => ({} as any));
    const recipient = json?.SMSMessageData?.Recipients?.[0];
    const ok = res.ok && (!recipient || String(recipient.status || "").toLowerCase().includes("success"));
    if (ok && options?.tenantId) await recordSmsMargin(options.tenantId);
    return { ok, provider: "africas-talking", messageId: recipient?.messageId || json?.SMSMessageData?.Message };
  } catch {
    return { ok: false, provider: "africas-talking" };
  }
}

/**
 * In development we also surface the OTP to the caller so the founder can test
 * login without a live SMS gateway. This is GATED to non-production only.
 */
export const SHOW_DEV_OTP = process.env.NODE_ENV !== "production";
