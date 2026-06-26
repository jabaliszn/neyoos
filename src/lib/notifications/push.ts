/**
 * Web Push transport (I.86 / A.7).
 * Uses stored browser/PWA subscriptions and VAPID keys from the encrypted NEYO
 * Ops Integration Credential Vault when configured. In dev without keys, it logs
 * to console but keeps the subscription pipeline testable.
 */
import webpush from "web-push";
import { db } from "@/lib/db";
import { readCompanySecret } from "@/lib/services/company-secret.service";

export interface SendPushResult {
  ok: boolean;
  provider: "dev-console" | "web-push";
  sent?: number;
  failed?: number;
}

export async function getVapidConfig() {
  const publicKey = (await readCompanySecret("vapid_public_key")) || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = (await readCompanySecret("vapid_private_key")) || process.env.VAPID_PRIVATE_KEY || "";
  const subject = (await readCompanySecret("vapid_subject")) || process.env.VAPID_SUBJECT || "mailto:support@neyo.co.ke";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
}

export async function sendPush(
  userId: string,
  title: string,
  body: string,
  href = "/dashboard"
): Promise<SendPushResult> {
  const subscriptions = await db.webPushSubscription.findMany({ where: { userId } });
  const vapid = await getVapidConfig();
  if (!vapid.configured || subscriptions.length === 0) {
    console.log(`\n[PUSH → user:${userId}] ${title} — ${body}\n`);
    return { ok: process.env.NODE_ENV !== "production", provider: "dev-console", sent: 0, failed: 0 };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let failed = 0;
  const payload = JSON.stringify({ title, body, href });
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
    } catch (e: any) {
      failed++;
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.webPushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
  return { ok: sent > 0, provider: "web-push", sent, failed };
}

export const PUSH_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
