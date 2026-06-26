import { z } from "zod";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";

export const customerThreadSchema = z.object({
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(3).max(3000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  source: z.enum(["SCHOOL_OS", "NEYO_OPS", "SMS", "EMAIL", "WHATSAPP", "CALL"]).default("SCHOOL_OS"),
});

export const customerReplySchema = z.object({
  threadId: z.string().min(1),
  body: z.string().trim().min(1).max(3000),
  direction: z.enum(["CUSTOMER", "NEYO", "INTERNAL"]).default("CUSTOMER"),
  channel: z.enum(["IN_APP", "SMS", "EMAIL", "WHATSAPP", "CALL_NOTE"]).default("IN_APP"),
});

export const customerThreadStatusSchema = z.object({
  threadId: z.string().min(1),
  status: z.enum(["OPEN", "WAITING_ON_NEYO", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

export async function listCustomerThreads(limit = 80) {
  return db.neyoCustomerThread.findMany({
    orderBy: [{ status: "asc" }, { priority: "desc" }, { lastMessageAt: "desc" }],
    take: limit,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
}

export async function listSchoolCustomerThreads(user: SessionUser) {
  return db.neyoCustomerThread.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
}

export async function createCustomerThread(user: SessionUser, input: z.infer<typeof customerThreadSchema>) {
  const data = customerThreadSchema.parse(input);
  const tenant = await db.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, phone: true } });
  const thread = await db.neyoCustomerThread.create({
    data: {
      tenantId: user.tenantId,
      schoolName: tenant?.name ?? "Unknown school",
      contactUserId: user.id,
      contactName: user.fullName,
      contactRole: user.role,
      contactEmail: user.email,
      contactPhone: user.phone ?? tenant?.phone ?? null,
      subject: data.subject,
      priority: data.priority,
      source: data.source,
      status: "WAITING_ON_NEYO",
      messages: { create: { direction: "CUSTOMER", body: data.body, authorId: user.id, authorName: user.fullName, authorRole: user.role, channel: "IN_APP" } },
    },
  });
  await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "platform.customer_thread_created", entityType: "NeyoCustomerThread", entityId: thread.id, metadata: JSON.stringify({ subject: data.subject, priority: data.priority }) } });
  return db.neyoCustomerThread.findUnique({ where: { id: thread.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
}

export async function addCustomerThreadMessage(actor: { id: string; fullName: string; role?: string; tenantId: string }, input: z.infer<typeof customerReplySchema>) {
  const data = customerReplySchema.parse(input);
  const thread = await db.neyoCustomerThread.findUnique({ where: { id: data.threadId } });
  if (!thread) throw new Error("Customer thread not found.");
  const message = await db.neyoCustomerMessage.create({ data: { threadId: thread.id, direction: data.direction, body: data.body, authorId: actor.id, authorName: actor.fullName, authorRole: actor.role, channel: data.channel } });
  const nextStatus = data.direction === "CUSTOMER" ? "WAITING_ON_NEYO" : data.direction === "NEYO" ? "WAITING_ON_CUSTOMER" : thread.status;
  await db.neyoCustomerThread.update({ where: { id: thread.id }, data: { status: nextStatus, lastMessageAt: new Date() } });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: data.direction === "NEYO" ? "platform.customer_thread_replied" : "platform.customer_thread_message_added", entityType: "NeyoCustomerThread", entityId: thread.id, metadata: JSON.stringify({ direction: data.direction, channel: data.channel }) } });

  if (data.direction === "NEYO" && thread.contactUserId && thread.tenantId) {
    const { createInApp } = await import("@/lib/services/notification.service");
    await createInApp({ tenantId: thread.tenantId, recipientId: thread.contactUserId, title: "Reply from NEYO", body: data.body, category: "support", href: "/settings/billing" });
  }
  return message;
}

export async function updateCustomerThreadStatus(actor: { id: string; fullName: string; tenantId: string }, input: z.infer<typeof customerThreadStatusSchema>) {
  const data = customerThreadStatusSchema.parse(input);
  const thread = await db.neyoCustomerThread.update({ where: { id: data.threadId }, data: { status: data.status, priority: data.priority } });
  await db.auditLog.create({ data: { tenantId: actor.tenantId, actorId: actor.id, actorName: actor.fullName, action: "platform.customer_thread_status_updated", entityType: "NeyoCustomerThread", entityId: thread.id, metadata: JSON.stringify({ status: thread.status, priority: thread.priority }) } });
  return thread;
}
