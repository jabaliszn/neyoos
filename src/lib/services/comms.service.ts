/**
 * B.14 Communication + I.10 permission refinements.
 *
 * Rules now enforced server-side:
 * - Parents/students do not have comms.send and cannot use bulk broadcast APIs.
 * - Teachers can prepare class-parent messages for THEIR OWN classes only.
 * - Teachers cannot send SMS.
 * - Teachers cannot directly broadcast; their in-app class-parent message goes
 *   to a Principal/Deputy/Owner approval queue first.
 * - Leadership/bursar/reception school-office users keep the preview-first
 *   send flow for school-wide, class, role, SMS and in-app messages.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { sendSms } from "@/lib/notifications/sms";
import { notify } from "@/lib/services/notification.service";
import { checkSmsQuota, recordUsage } from "@/lib/services/limits.service";
import { channelCost } from "@/lib/core/channels";
import { ROLES, type Role } from "@/lib/core/roles";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import type { SessionUser } from "@/lib/core/session";
import { assertRespectfulContent } from "@/lib/services/content-moderation.service";

export class CommsError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID" | "QUOTA" | "EMPTY" | "FORBIDDEN" | "STATE", message: string) {
    super(message);
    this.name = "CommsError";
  }
}

const TEACHING_ROLES: Role[] = ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"];
const APPROVER_ROLES: Role[] = ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"];

function roleList(user: SessionUser): Role[] {
  return [user.role, user.secondaryRole].filter(Boolean) as Role[];
}
function isTeachingUser(user: SessionUser) {
  return roleList(user).some((r) => TEACHING_ROLES.includes(r));
}
function isTeacherCommsApprover(user: SessionUser) {
  return roleList(user).some((r) => APPROVER_ROLES.includes(r));
}

async function assertTeacherClassAllowed(user: SessionUser, classId: string) {
  const allowed = await teacherClassIds(user);
  if (allowed !== null && !allowed.includes(classId)) {
    throw new CommsError("FORBIDDEN", "That is not one of your classes.");
  }
}

/**
 * School-office send guard. Teachers are deliberately excluded from direct send;
 * they use requestTeacherMessageApproval() instead.
 */
async function assertAudienceAllowed(user: SessionUser, input: { audienceType: string; classId?: string; channel: "sms" | "in_app"; dryRun?: boolean }) {
  if (!isTeachingUser(user)) return;

  if (input.channel === "sms") {
    throw new CommsError("FORBIDDEN", "Teachers cannot send SMS. Request an in-app class message for approval instead.");
  }
  if (input.audienceType !== "CLASS_GUARDIANS") {
    throw new CommsError("FORBIDDEN", "Teachers can only request messages to parents of their own classes.");
  }
  if (!input.classId) throw new CommsError("INVALID", "Pick the class.");
  await assertTeacherClassAllowed(user, input.classId);

  // Dry-run preview is allowed so the teacher can see who will receive it.
  // Actual send is blocked unless the Principal/Deputy approves the request.
  if (!input.dryRun) {
    throw new CommsError("FORBIDDEN", "Submit this class message for Principal or Deputy approval before it is sent.");
  }
}

interface Target {
  phone?: string | null;
  userId?: string | null;
  label: string;
}
interface ResolvedAudience {
  label: string;
  targets: Target[];
}

const classLabel = (c: { level: string; stream: string | null }) =>
  [c.level, c.stream].filter(Boolean).join(" ");

/** Resolve WHO gets the message. Guardian audiences dedupe by phone/user. */
async function resolveAudience(input: { audienceType: string; classId?: string; role?: string }): Promise<ResolvedAudience> {
  if (input.audienceType === "ROLE") {
    const role = input.role as Role;
    if (!ROLES.includes(role)) throw new CommsError("INVALID", "Unknown role.");
    const users = await tenantDb().user.findMany({
      where: { role, isActive: true },
      select: { id: true, fullName: true, phone: true },
    });
    return {
      label: `All ${role.toLowerCase().replace(/_/g, " ")}s`,
      targets: users.map((u) => ({ userId: u.id, phone: u.phone, label: u.fullName })),
    };
  }

  let studentWhere: Record<string, unknown> = { status: "ACTIVE", deletedAt: null };
  let label = "All parents/guardians";
  if (input.audienceType === "CLASS_GUARDIANS") {
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId! } });
    if (!cls) throw new CommsError("NOT_FOUND", "Class not found.");
    studentWhere = { ...studentWhere, classId: cls.id };
    label = `${classLabel(cls)} parents`;
  }

  const links = await tenantDb().studentGuardian.findMany({
    where: { student: studentWhere },
    include: { guardian: true },
  });

  const byKey = new Map<string, Target>();
  for (const l of links) {
    const key = l.guardian.userId || l.guardian.phone;
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { phone: l.guardian.phone, userId: l.guardian.userId, label: l.guardian.fullName });
    }
  }
  return { label, targets: [...byKey.values()] };
}

async function sendResolvedAudience(
  user: SessionUser,
  input: { audienceType: string; classId?: string; role?: string; channel: "sms" | "in_app"; body: string },
  audience: ResolvedAudience
) {
  if (audience.targets.length === 0) {
    throw new CommsError("EMPTY", "Nobody matches that audience (no phone numbers / users found).");
  }
  assertRespectfulContent(input.body, input.channel === "sms" ? "SMS broadcast" : "announcement");

  const count = audience.targets.length;
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: user.tenantId }, select: { name: true } });
  let sent = 0;
  let skipped = 0;
  const skippedWho: string[] = [];

  for (const t of audience.targets) {
    try {
      if (input.channel === "sms") {
        if (!t.phone) { skipped++; skippedWho.push(t.label); continue; }
        const r = await sendSms(t.phone, `${tenant.name}: ${input.body}`);
        if (r.ok) sent++; else { skipped++; skippedWho.push(t.label); }
      } else {
        if (!t.userId) { skipped++; skippedWho.push(t.label); continue; }
        await notify({
          tenantId: user.tenantId,
          recipientId: t.userId,
          title: `Message from ${tenant.name}`,
          body: input.body,
          category: "announcement",
          channels: ["in_app"],
        });
        sent++;
      }
    } catch {
      skipped++; skippedWho.push(t.label);
    }
  }

  if (input.channel === "sms" && sent > 0) {
    await recordUsage(user.tenantId, "smsPerTerm", sent);
  }

  const record = await db.bulkMessage.create({
    data: {
      tenantId: user.tenantId,
      audienceType: input.audienceType,
      classId: input.classId ?? null,
      audienceLabel: audience.label,
      role: input.role ?? null,
      channel: input.channel,
      body: input.body,
      recipientCount: count,
      sentCount: sent,
      skippedCount: skipped,
      costKes: input.channel === "sms" ? channelCost("sms", sent) : 0,
      senderId: user.id,
      senderName: user.fullName,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "comms.bulk_sent",
      entityType: "bulkMessage",
      entityId: record.id,
      metadata: JSON.stringify({ audience: audience.label, channel: input.channel, sent, skipped }),
    },
  });

  return { dryRun: false, id: record.id, recipientCount: count, sent, skipped, skippedWho: skippedWho.slice(0, 10), costKes: record.costKes, audienceLabel: audience.label };
}

export async function bulkSend(
  user: SessionUser,
  input: { audienceType: string; classId?: string; role?: string; channel: "sms" | "in_app"; body: string; dryRun?: boolean }
) {
  return withTenant(user.tenantId, async () => {
    await assertAudienceAllowed(user, input);
    assertRespectfulContent(input.body, input.channel === "sms" ? "SMS broadcast" : "announcement");
    const audience = await resolveAudience(input);
    if (audience.targets.length === 0) {
      throw new CommsError("EMPTY", "Nobody matches that audience (no phone numbers / users found).");
    }

    const count = audience.targets.length;
    const costKes = input.channel === "sms" ? channelCost("sms", count) : 0;

    let quotaMessage: string | undefined;
    if (input.channel === "sms") {
      const quota = await checkSmsQuota(user.tenantId, count);
      quotaMessage = quota.message;
      if (!quota.allowed) {
        if (input.dryRun) {
          return { dryRun: true, allowed: false, recipientCount: count, audienceLabel: audience.label, costKes, quota: quota.status, message: quota.message };
        }
        throw new CommsError("QUOTA", quota.message ?? "SMS quota exceeded.");
      }
    }

    if (input.dryRun) {
      return { dryRun: true, allowed: true, recipientCount: count, audienceLabel: audience.label, costKes, message: quotaMessage };
    }

    return { ...(await sendResolvedAudience(user, input, audience)), message: quotaMessage };
  });
}

/** Teacher submits an in-app class-parent message for approval. */
export async function requestTeacherMessageApproval(
  user: SessionUser,
  input: { classId: string; channel: "in_app"; body: string }
) {
  return withTenant(user.tenantId, async () => {
    if (!isTeachingUser(user)) {
      throw new CommsError("FORBIDDEN", "Only teachers use this approval queue.");
    }
    await assertTeacherClassAllowed(user, input.classId);

    const audience = await resolveAudience({ audienceType: "CLASS_GUARDIANS", classId: input.classId });
    if (audience.targets.length === 0) throw new CommsError("EMPTY", "No parent accounts match this class.");

    const req = await db.teacherCommsApprovalRequest.create({
      data: {
        tenantId: user.tenantId,
        audienceType: "CLASS_GUARDIANS",
        classId: input.classId,
        audienceLabel: audience.label,
        channel: "in_app",
        body: input.body,
        recipientCount: audience.targets.length,
        requestedById: user.id,
        requestedByName: user.fullName,
      },
    });

    const approvers = await db.user.findMany({
      where: { tenantId: user.tenantId, isActive: true, role: { in: APPROVER_ROLES.filter((r) => r !== "SUPER_ADMIN") } },
      select: { id: true },
    });
    for (const a of approvers) {
      await notify({
        tenantId: user.tenantId,
        recipientId: a.id,
        title: "Teacher message needs approval",
        body: `${user.fullName} wants to message ${audience.label}.`,
        category: "approval",
        channels: ["in_app"],
        href: "/comms",
      });
    }

    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.fullName,
        action: "comms.teacher_approval_requested",
        entityType: "teacherCommsApprovalRequest",
        entityId: req.id,
        metadata: JSON.stringify({ audience: audience.label, channel: "in_app", recipientCount: audience.targets.length }),
      },
    });

    return { id: req.id, status: req.status, audienceLabel: req.audienceLabel, recipientCount: req.recipientCount };
  });
}

export async function decideTeacherMessageApproval(
  user: SessionUser,
  input: { requestId: string; action: "approve_teacher_message" | "reject_teacher_message"; note?: string }
) {
  return withTenant(user.tenantId, async () => {
    if (!isTeacherCommsApprover(user)) {
      throw new CommsError("FORBIDDEN", "Only the Principal, Deputy or Owner can approve teacher messages.");
    }

    const req = await tenantDb().teacherCommsApprovalRequest.findUnique({ where: { id: input.requestId } });
    if (!req) throw new CommsError("NOT_FOUND", "Approval request not found.");
    if (req.status !== "PENDING") throw new CommsError("STATE", "This request has already been decided.");
    if (req.requestedById === user.id) throw new CommsError("FORBIDDEN", "You cannot approve your own message request.");

    if (input.action === "reject_teacher_message") {
      const updated = await db.teacherCommsApprovalRequest.update({
        where: { id: req.id },
        data: { status: "REJECTED", decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), decisionNote: input.note ?? null },
      });
      await db.auditLog.create({
        data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "comms.teacher_approval_rejected", entityType: "teacherCommsApprovalRequest", entityId: req.id },
      });
      return { id: updated.id, status: updated.status };
    }

    const requester = await db.user.findUnique({ where: { id: req.requestedById } });
    if (!requester || !requester.isActive) throw new CommsError("NOT_FOUND", "The requesting teacher is no longer active.");
    const sender: SessionUser = {
      id: requester.id,
      tenantId: requester.tenantId,
      neyoLoginId: requester.neyoLoginId,
      fullName: requester.fullName,
      phone: requester.phone,
      email: requester.email,
      role: requester.role as Role,
      secondaryRole: requester.secondaryRole as Role | null,
      language: requester.language ?? "en",
      popupStyle: requester.popupStyle ?? "glass",
    };

    const audience = await resolveAudience({ audienceType: req.audienceType, classId: req.classId });
    const sent = await sendResolvedAudience(sender, { audienceType: req.audienceType, classId: req.classId, channel: "in_app", body: req.body }, audience);

    const updated = await db.teacherCommsApprovalRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED", decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), decisionNote: input.note ?? null, bulkMessageId: sent.id },
    });

    await db.auditLog.create({
      data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "comms.teacher_approval_approved", entityType: "teacherCommsApprovalRequest", entityId: req.id, metadata: JSON.stringify({ bulkMessageId: sent.id }) },
    });

    return { id: updated.id, status: updated.status, bulkMessageId: sent.id, sent: sent.sent, recipientCount: sent.recipientCount };
  });
}

export async function audienceOptions(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const teaching = isTeachingUser(user);
    const allowedClassIds = teaching ? await teacherClassIds(user) : null;

    const classes = await tenantDb().schoolClass.findMany({
      where: {
        archived: false,
        ...(allowedClassIds !== null ? { id: { in: allowedClassIds } } : {}),
      },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });
    const classOpts = [];
    for (const c of classes) {
      const a = await resolveAudience({ audienceType: "CLASS_GUARDIANS", classId: c.id }).catch(() => null);
      classOpts.push({ id: c.id, label: classLabel(c), families: a?.targets.length ?? 0 });
    }

    if (teaching) {
      return { teacherScoped: true, requiresApproval: true, schoolFamilies: 0, classes: classOpts, roles: [] as { role: string; users: number }[] };
    }

    const school = await resolveAudience({ audienceType: "SCHOOL_GUARDIANS" });
    const roleCounts = await tenantDb().user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
    return {
      teacherScoped: false,
      requiresApproval: false,
      schoolFamilies: school.targets.length,
      classes: classOpts,
      roles: roleCounts.map((r) => ({ role: r.role, users: r._count._all })).sort((a, b) => b.users - a.users),
    };
  });
}

export async function listBulkMessages(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    return tenantDb().bulkMessage.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  });
}

export async function listTeacherMessageApprovals(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const where = isTeacherCommsApprover(user)
      ? {}
      : isTeachingUser(user)
        ? { requestedById: user.id }
        : { id: "__none__" };
    return tenantDb().teacherCommsApprovalRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    });
  });
}
