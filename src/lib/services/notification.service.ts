/**
 * Notification service (Feature A.7).
 * - createInApp: writes to the recipient's in-app inbox.
 * - notify: full cascade (in-app -> push -> whatsapp -> sms -> email),
 *   respecting per-user opt-outs and the requested channel set; audit-logged.
 * - cost preview, unsubscribe, list/read.
 */
import { db } from "@/lib/db";
import {
  CASCADE_ORDER,
  channelDefs,
  channelCost,
  type Channel,
} from "@/lib/core/channels";
import { sendSms } from "@/lib/notifications/sms";
import { sendEmail } from "@/lib/notifications/email";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { sendPush } from "@/lib/notifications/push";

export interface NotifyInput {
  tenantId: string;
  recipientId: string;
  title: string;
  body: string;
  category?: string;
  href?: string;
  /** Which channels to attempt (defaults to in-app only). */
  channels?: Channel[];
  /** Stop after the first successful external channel (true) or try all (false). */
  cascade?: boolean;
}

/** Read a user's opted-out channels. */
async function getOptOut(userId: string): Promise<Set<Channel>> {
  const pref = await db.notificationPreference.findUnique({ where: { userId } });
  if (!pref) return new Set();
  try {
    const map = JSON.parse(pref.optOut) as Record<string, boolean>;
    return new Set(
      Object.entries(map)
        .filter(([, off]) => off)
        .map(([ch]) => ch as Channel)
    );
  } catch {
    return new Set();
  }
}

/** Create an in-app notification only. */
export async function createInApp(
  input: Omit<NotifyInput, "channels" | "cascade">
) {
  return db.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      title: input.title,
      body: input.body,
      category: input.category ?? "general",
      href: input.href,
      channels: JSON.stringify({ in_app: "sent" }),
    },
  });
}

/**
 * Full multi-channel notify with cascade. Always creates the in-app record.
 * Returns per-channel delivery results.
 */
export async function notify(input: NotifyInput) {
  const requested = new Set(input.channels ?? ["in_app"]);
  const optOut = await getOptOut(input.recipientId);
  const recipient = await db.user.findUnique({
    where: { id: input.recipientId },
    select: { phone: true, email: true },
  });

  const results: Record<string, string> = {};
  let externalDelivered = false;

  for (const ch of CASCADE_ORDER) {
    if (!requested.has(ch)) continue;
    if (optOut.has(ch)) {
      results[ch] = "opted_out";
      continue;
    }
    // If cascading and we already delivered via an external channel, skip rest.
    if (input.cascade && externalDelivered && ch !== "in_app") {
      results[ch] = "skipped";
      continue;
    }

    try {
      if (ch === "in_app") {
        results[ch] = "sent"; // record created below
      } else if (ch === "push") {
        const r = await sendPush(input.recipientId, input.title, input.body, input.href || "/dashboard");
        results[ch] = r.ok ? "sent" : "failed";
        if (r.ok) externalDelivered = true;
      } else if (ch === "whatsapp") {
        if (!recipient?.phone) { results[ch] = "no_phone"; continue; }
        const r = await sendWhatsApp(recipient.phone, `${input.title}\n${input.body}`, { tenantId: input.tenantId });
        results[ch] = r.ok ? "sent" : "failed";
        if (r.ok) externalDelivered = true;
      } else if (ch === "sms") {
        if (!recipient?.phone) { results[ch] = "no_phone"; continue; }
        const r = await sendSms(recipient.phone, `${input.title}: ${input.body}`, { tenantId: input.tenantId });
        results[ch] = r.ok ? "sent" : "failed";
        if (r.ok) externalDelivered = true;
      } else if (ch === "email") {
        if (!recipient?.email) { results[ch] = "no_email"; continue; }
        const r = await sendEmail(recipient.email, input.title, input.body);
        results[ch] = r.ok ? "sent" : "failed";
        if (r.ok) externalDelivered = true;
      }
    } catch {
      results[ch] = "failed";
    }
  }

  const record = await db.notification.create({
    data: {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      title: input.title,
      body: input.body,
      category: input.category ?? "general",
      href: input.href,
      channels: JSON.stringify(results),
    },
  });

  await db.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorName: "Notifications",
      action: "notification.sent",
      entityType: "Notification",
      entityId: record.id,
      metadata: JSON.stringify({ channels: results, category: record.category }),
    },
  });

  return { notification: record, results };
}

/** Pre-send cost preview (A.7) for sending to N recipients over given channels. */
export function previewCost(channels: Channel[], recipientCount: number) {
  const defs = channelDefs();
  const lines = channels.map((ch) => ({
    channel: ch,
    label: defs[ch].label,
    configured: defs[ch].configured,
    unitCost: defs[ch].costKes,
    total: channelCost(ch, recipientCount),
  }));
  const totalKes = lines.reduce((s, l) => s + l.total, 0);
  return { recipientCount, lines, totalKes };
}

/** List a recipient's notifications (newest first). */
export async function listForUser(recipientId: string, limit = 30) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({ where: { recipientId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(recipientId: string, id: string) {
  await db.notification.updateMany({
    where: { id, recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(recipientId: string) {
  await db.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Update a user's channel opt-outs (A.7 unsubscribe management). */
export async function setOptOut(userId: string, channel: Channel, off: boolean) {
  const pref = await db.notificationPreference.findUnique({ where: { userId } });
  const map: Record<string, boolean> = pref ? JSON.parse(pref.optOut) : {};
  map[channel] = off;
  await db.notificationPreference.upsert({
    where: { userId },
    update: { optOut: JSON.stringify(map) },
    create: { userId, optOut: JSON.stringify(map) },
  });
}

export async function getUnreadCount(recipientId: string) {
  return db.notification.count({ where: { recipientId, readAt: null } });
}
