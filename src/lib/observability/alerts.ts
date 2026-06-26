/**
 * Ops alert routing (Feature A.13). Reuses the A.7 notification cascade to send
 * critical alerts to NEYO admins via in-app + (when keyed) SMS/WhatsApp/email.
 */
import { db } from "@/lib/db";
import { notify } from "@/lib/services/notification.service";
import { captureMessage } from "@/lib/observability/capture";

/** Send a critical ops alert to all SUPER_ADMIN users. */
export async function sendOpsAlert(title: string, body: string) {
  captureMessage(`ops_alert: ${title}`, { body });
  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN", isActive: true },
    select: { id: true, tenantId: true },
  });
  for (const a of admins) {
    await notify({
      tenantId: a.tenantId,
      recipientId: a.id,
      title,
      body,
      category: "system",
      channels: ["in_app", "sms", "email"],
      cascade: true,
    });
  }
  return { notified: admins.length };
}
