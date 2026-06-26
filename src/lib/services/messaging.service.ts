/**
 * In-app messaging service (Feature A.8).
 * Tenant-scoped (all conversations carry tenantId). Real-time delivery uses the
 * SSE pattern (A.7); attachments use a field that A.9 file storage will fill.
 */
import { db } from "@/lib/db";
import { createInApp } from "@/lib/services/notification.service";
import { sendSms } from "@/lib/notifications/sms";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { can } from "@/lib/core/permissions";
import type { Role } from "@/lib/core/roles";
import { assertRespectfulContent } from "@/lib/services/content-moderation.service";

export class MessagingError extends Error {
  constructor(
    public code: "NOT_PARTICIPANT" | "NOT_FOUND" | "ANNOUNCEMENT_LOCKED" | "CONTENT_MODERATED" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

/** Assert a user participates in a conversation; returns the participant row. */
async function requireParticipant(conversationId: string, userId: string) {
  const p = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!p) throw new MessagingError("NOT_PARTICIPANT", "You're not in this conversation.");
  return p;
}

/**
 * Create a conversation. For DIRECT (1:1) we reuse an existing thread between
 * the same two people instead of creating duplicates.
 */
export async function createConversation(
  tenantId: string,
  creator: { id: string; fullName: string; role?: Role; secondaryRole?: Role | null },
  input: {
    type: "DIRECT" | "GROUP" | "ANNOUNCEMENT";
    title?: string;
    participantIds: string[];
  }
) {
  const memberIds = Array.from(new Set([creator.id, ...input.participantIds]));

  // I.10: student/parent accounts cannot create school-wide/group/announcement
  // channels. They use their class group chat or direct one-person conversations.
  const creatorRoles = [creator.role, creator.secondaryRole].filter(Boolean) as Role[];
  const isFamilyAccount = creatorRoles.some((r) => r === "PARENT" || r === "STUDENT");
  if (isFamilyAccount) {
    if (input.type !== "DIRECT" || input.participantIds.length !== 1) {
      throw new MessagingError("FORBIDDEN", "Parents and students can only start one-to-one school conversations or use their class group chat.");
    }
  }

  // Announcements are a broadcast surface. Only users with comms.send can create them.
  if (input.type === "ANNOUNCEMENT" && !creatorRoles.some((r) => can(r, "comms.send"))) {
    throw new MessagingError("FORBIDDEN", "You cannot create school announcements.");
  }

  if (input.type === "DIRECT" && memberIds.length === 2) {
    // Find an existing 1:1 between exactly these two.
    const existing = await db.conversation.findFirst({
      where: {
        tenantId,
        type: "DIRECT",
        participants: { every: { userId: { in: memberIds } } },
      },
      include: { participants: true },
    });
    if (existing && existing.participants.length === 2) return existing;
  }

  return db.conversation.create({
    data: {
      tenantId,
      type: input.type,
      title: input.title,
      createdById: creator.id,
      participants: {
        create: memberIds.map((uid) => ({
          userId: uid,
          role:
            input.type === "ANNOUNCEMENT" && uid === creator.id
              ? "admin"
              : "member",
          // Sender starts "caught up"; others have it unread.
          lastReadAt: uid === creator.id ? new Date() : null,
        })),
      },
    },
    include: { participants: true },
  });
}

/** Send a message. Enforces participation + announcement reply-lock. */
export async function sendMessage(
  tenantId: string,
  sender: { id: string; fullName: string },
  input: { conversationId: string; body: string; attachmentUrl?: string; attachmentName?: string; requiresAck?: boolean; urgentAfterHours?: 6 | 12 | 24 }
) {
  const convo = await db.conversation.findFirst({
    where: { id: input.conversationId, tenantId },
    include: { participants: true },
  });
  if (!convo) throw new MessagingError("NOT_FOUND", "Conversation not found.");

  const me = await requireParticipant(convo.id, sender.id);

  assertRespectfulContent(input.body, "message");

  // Announcements: only the admin (sender) may post; others can't reply.
  if (convo.type === "ANNOUNCEMENT" && me.role !== "admin") {
    throw new MessagingError(
      "ANNOUNCEMENT_LOCKED",
      "Announcements don't accept replies."
    );
  }

  const urgentFallbackAt = input.urgentAfterHours
    ? new Date(Date.now() + input.urgentAfterHours * 60 * 60 * 1000)
    : null;

  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId: convo.id,
        tenantId,
        senderId: sender.id,
        senderName: sender.fullName,
        body: input.body,
        attachmentUrl: input.attachmentUrl,
        attachmentName: input.attachmentName,
        requiresAck: Boolean(input.requiresAck),
        urgentFallbackAt,
      },
    }),
    db.conversation.update({
      where: { id: convo.id },
      data: { updatedAt: new Date() },
    }),
    // Sender is caught up on their own message.
    db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: convo.id, userId: sender.id } },
      data: { lastReadAt: new Date() },
    }),
  ]);

  // Fire an in-app notification to every other participant.
  const others = convo.participants.filter((p) => p.userId !== sender.id);
  for (const p of others) {
    await createInApp({
      tenantId,
      recipientId: p.userId,
      title:
        convo.type === "DIRECT"
          ? `Message from ${sender.fullName}`
          : `${convo.title ?? "Group"}: ${sender.fullName}`,
      body: input.body.slice(0, 120),
      category: "message",
      href: `/messages?c=${convo.id}`,
    });
  }

  return message;
}

/** List a user's conversations with last message + unread count. */
export async function listConversations(tenantId: string, userId: string) {
  const convos = await db.conversation.findMany({
    where: { tenantId, participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return Promise.all(
    convos.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const unread = await db.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          createdAt: me?.lastReadAt ? { gt: me.lastReadAt } : undefined,
        },
      });
      // Resolve a display title for 1:1 (the other person's name).
      let title = c.title;
      if (c.type === "DIRECT") {
        const otherId = c.participants.find((p) => p.userId !== userId)?.userId;
        if (otherId) {
          const other = await db.user.findUnique({
            where: { id: otherId },
            select: { fullName: true },
          });
          title = other?.fullName ?? "Conversation";
        }
      }
      return {
        id: c.id,
        type: c.type,
        title: title ?? "Conversation",
        classId: c.classId,
        lastMessage: c.messages[0]?.body ?? null,
        lastAt: c.messages[0]?.createdAt ?? c.createdAt,
        unread,
      };
    })
  );
}

/** Fetch messages for a conversation (participant-checked) + mark read. */
export async function getMessages(
  tenantId: string,
  userId: string,
  conversationId: string,
  opts?: { markRead?: boolean }
) {
  const convo = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!convo) throw new MessagingError("NOT_FOUND", "Conversation not found.");
  await requireParticipant(conversationId, userId);

  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  if (opts?.markRead) {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  // I.70 read receipts: include WHO read and WHEN. A participant has read a
  // message when their lastReadAt is at/after the message timestamp.
  const participants = await db.conversationParticipant.findMany({
    where: { conversationId },
    include: { conversation: false },
  });
  const users = await db.user.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, fullName: true, role: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const acknowledgements = await db.messageAcknowledgement.findMany({
    where: { messageId: { in: messages.map((m) => m.id) } },
  });
  const ackByMessage = new Map<string, typeof acknowledgements>();
  for (const ack of acknowledgements) {
    const list = ackByMessage.get(ack.messageId) ?? [];
    list.push(ack);
    ackByMessage.set(ack.messageId, list);
  }

  return {
    currentUserId: userId,
    conversation: { id: convo.id, type: convo.type, title: convo.title, classId: convo.classId },
    messages: messages.map((m) => {
      const readBy = participants
        .filter((p) => p.userId !== m.senderId && p.lastReadAt && p.lastReadAt >= m.createdAt)
        .map((p) => {
          const u = userById.get(p.userId);
          return { userId: p.userId, name: u?.fullName ?? "Unknown user", role: u?.role ?? "", readAt: p.lastReadAt! };
        });
      const ackBy = (ackByMessage.get(m.id) ?? []).map((a) => ({
        userId: a.userId,
        name: a.userName,
        acknowledgedAt: a.acknowledgedAt,
      }));
      return {
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        body: m.body,
        attachmentUrl: m.attachmentUrl,
        attachmentName: m.attachmentName,
        requiresAck: m.requiresAck,
        urgentFallbackAt: m.urgentFallbackAt,
        fallbackSmsSentAt: m.fallbackSmsSentAt,
        acknowledgedByMe: ackBy.some((a) => a.userId === userId),
        readBy,
        ackBy,
        createdAt: m.createdAt,
        mine: m.senderId === userId,
      };
    }),
  };
}

/** Total unread messages across all of a user's conversations. */
export async function totalUnread(tenantId: string, userId: string) {
  const convos = await listConversations(tenantId, userId);
  return convos.reduce((s, c) => s + c.unread, 0);
}

/** Search within a conversation (participant-checked). */
export async function searchMessages(
  tenantId: string,
  userId: string,
  conversationId: string,
  q: string
) {
  const convo = await db.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!convo) throw new MessagingError("NOT_FOUND", "Conversation not found.");
  await requireParticipant(conversationId, userId);

  const results = await db.message.findMany({
    where: { conversationId, body: { contains: q } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return results.map((m) => ({
    id: m.id,
    senderName: m.senderName,
    body: m.body,
    createdAt: m.createdAt,
  }));
}


/** I.85 — user taps "I received this" for a message. */
export async function acknowledgeMessage(
  tenantId: string,
  user: { id: string; fullName: string },
  input: { conversationId: string; messageId: string }
) {
  const convo = await db.conversation.findFirst({ where: { id: input.conversationId, tenantId } });
  if (!convo) throw new MessagingError("NOT_FOUND", "Conversation not found.");
  await requireParticipant(input.conversationId, user.id);

  const msg = await db.message.findFirst({ where: { id: input.messageId, conversationId: input.conversationId, tenantId } });
  if (!msg) throw new MessagingError("NOT_FOUND", "Message not found.");
  if (!msg.requiresAck) throw new MessagingError("FORBIDDEN", "This message does not need acknowledgement.");
  if (msg.senderId === user.id) throw new MessagingError("FORBIDDEN", "You cannot acknowledge your own message.");

  const ack = await db.messageAcknowledgement.upsert({
    where: { messageId_userId: { messageId: msg.id, userId: user.id } },
    update: { acknowledgedAt: new Date(), userName: user.fullName },
    create: { tenantId, messageId: msg.id, userId: user.id, userName: user.fullName },
  });
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: input.conversationId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });
  return { acknowledgedAt: ack.acknowledgedAt };
}

/** Secure server-side disappearing voice note action. */
export async function disappearMessageAttachment(
  tenantId: string,
  userId: string,
  input: { conversationId: string; messageId: string }
) {
  const msg = await db.message.findFirst({ where: { id: input.messageId, conversationId: input.conversationId, tenantId } });
  if (!msg) throw new MessagingError("NOT_FOUND", "Message not found.");
  await requireParticipant(input.conversationId, userId);
  if (msg.attachmentName !== "voice_note:disappearing") {
    throw new MessagingError("FORBIDDEN", "Only disappearing voice notes can be wiped this way.");
  }
  await db.message.update({
    where: { id: msg.id },
    data: {
      body: "🎙️ [Voice Note Disappeared to save storage]",
      attachmentUrl: null,
      attachmentName: null,
    },
  });
  return { success: true };
}

/** I.85 — sends SMS fallback for urgent messages not read/acknowledged by deadline. */
export async function sendUnreadMessageFallbacks() {
  const now = new Date();
  const due = await db.message.findMany({
    where: {
      urgentFallbackAt: { lte: now },
      fallbackSmsSentAt: null,
    },
    include: { conversation: { include: { participants: true } }, acknowledgements: true },
    take: 100,
  });

  let messagesChecked = 0;
  let smsSent = 0;
  for (const m of due) {
    messagesChecked++;
    const recipients = m.conversation.participants.filter((p) => {
      if (p.userId === m.senderId) return false;
      const read = p.lastReadAt && p.lastReadAt >= m.createdAt;
      const acked = m.acknowledgements.some((a) => a.userId === p.userId);
      return !read && !acked;
    });
    if (recipients.length === 0) {
      await db.message.update({ where: { id: m.id }, data: { fallbackSmsSentAt: now } });
      continue;
    }

    const users = await db.user.findMany({ where: { id: { in: recipients.map((r) => r.userId) }, isActive: true }, select: { id: true, phone: true } });
    const tenant = await db.tenant.findUnique({ where: { id: m.tenantId }, select: { name: true } });
    let sentForMessage = 0;
    for (const u of users) {
      if (!u.phone) continue;
      const quota = await checkSmsQuota(m.tenantId, 1);
      if (!quota.allowed) break;
      const res = await sendSms(u.phone, `${tenant?.name ?? "School"}: You have an unread school message from ${m.senderName}. Please open NEYO messages and confirm receipt.`);
      if (res.ok) {
        sentForMessage++;
        smsSent++;
        await recordUsage(m.tenantId, "smsPerTerm", 1);
      }
    }
    await db.message.update({ where: { id: m.id }, data: { fallbackSmsSentAt: now } });
    await db.auditLog.create({
      data: {
        tenantId: m.tenantId,
        actorId: m.senderId,
        actorName: m.senderName,
        action: "message.sms_fallback_sent",
        entityType: "message",
        entityId: m.id,
        metadata: JSON.stringify({ sent: sentForMessage, conversationId: m.conversationId }),
      },
    });
  }
  return { messagesChecked, smsSent };
}

function isReportableMessage(m: { requiresAck: boolean; urgentFallbackAt: Date | null }) {
  return m.requiresAck || Boolean(m.urgentFallbackAt);
}

async function buildDeliveryReport(messageId: string, notifySender: boolean) {
  const m = await db.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: { include: { participants: true } },
      acknowledgements: true,
      deliveryReport: true,
    },
  });
  if (!m) throw new MessagingError("NOT_FOUND", "Message not found.");
  if (!isReportableMessage(m)) {
    throw new MessagingError("FORBIDDEN", "This message does not have delivery tracking enabled.");
  }

  const recipients = m.conversation.participants.filter((p) => p.userId !== m.senderId);
  const recipientUsers = await db.user.findMany({
    where: { id: { in: recipients.map((r) => r.userId) } },
    select: { id: true, fullName: true, phone: true },
  });
  const userById = new Map(recipientUsers.map((u) => [u.id, u]));

  const readIds = new Set(
    recipients
      .filter((p) => p.lastReadAt && p.lastReadAt >= m.createdAt)
      .map((p) => p.userId)
  );
  const ackIds = new Set(m.acknowledgements.map((a) => a.userId));
  const unread = recipients
    .filter((p) => !readIds.has(p.userId) && !ackIds.has(p.userId))
    .map((p) => {
      const u = userById.get(p.userId);
      return { userId: p.userId, name: u?.fullName ?? "Unknown user", phone: u?.phone ?? null };
    });

  const recipientCount = recipients.length;
  const readCount = readIds.size;
  const ackCount = ackIds.size;
  const unreadCount = unread.length;
  const smsFallbackSentCount = m.fallbackSmsSentAt ? unreadCount : 0;
  const summary = `${readCount} read · ${ackCount} confirmed received · ${unreadCount} not read${m.fallbackSmsSentAt ? ` · SMS fallback sent` : ""}`;

  const report = await db.messageDeliveryReport.upsert({
    where: { messageId: m.id },
    update: {
      recipientCount,
      readCount,
      ackCount,
      unreadCount,
      smsFallbackSentCount,
      unreadJson: JSON.stringify(unread),
      summary,
    },
    create: {
      tenantId: m.tenantId,
      messageId: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.senderName,
      recipientCount,
      readCount,
      ackCount,
      unreadCount,
      smsFallbackSentCount,
      unreadJson: JSON.stringify(unread),
      summary,
    },
  });

  if (notifySender && !report.notifiedAt) {
    await createInApp({
      tenantId: m.tenantId,
      recipientId: m.senderId,
      title: "Message delivery report ready",
      body: summary,
      category: "message",
      href: `/messages?open=${m.conversationId}`,
    });
    await db.messageDeliveryReport.update({ where: { id: report.id }, data: { notifiedAt: new Date() } });
  }

  return {
    id: report.id,
    messageId: m.id,
    conversationId: m.conversationId,
    recipientCount,
    readCount,
    ackCount,
    unreadCount,
    smsFallbackSentCount,
    unread,
    summary,
    generatedAt: report.generatedAt,
    notifiedAt: report.notifiedAt,
  };
}

/** I.85 — sender opens an existing/generated delivery report for one message. */
export async function messageDeliveryReport(
  tenantId: string,
  userId: string,
  input: { conversationId: string; messageId: string }
) {
  const msg = await db.message.findFirst({
    where: { id: input.messageId, conversationId: input.conversationId, tenantId },
  });
  if (!msg) throw new MessagingError("NOT_FOUND", "Message not found.");
  await requireParticipant(input.conversationId, userId);
  if (msg.senderId !== userId) {
    throw new MessagingError("FORBIDDEN", "Only the sender can view this delivery report.");
  }

  const dueAt = new Date(msg.createdAt.getTime() + 24 * 60 * 60 * 1000);
  const existing = await db.messageDeliveryReport.findUnique({ where: { messageId: msg.id } });
  if (!existing && dueAt > new Date()) {
    return { pending: true, dueAt, message: "The 24-hour report is not ready yet." };
  }
  return { pending: false, report: await buildDeliveryReport(msg.id, false) };
}

/** I.85 — background job: generate 24-hour sender reports and notify senders. */
export async function generateDueMessageDeliveryReports() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const due = await db.message.findMany({
    where: {
      createdAt: { lte: cutoff },
      OR: [{ requiresAck: true }, { NOT: { urgentFallbackAt: null } }],
      deliveryReport: null,
    },
    take: 100,
  });
  let generated = 0;
  for (const m of due) {
    await buildDeliveryReport(m.id, true);
    generated++;
  }
  return { generated };
}
