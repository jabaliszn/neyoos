/**
 * I.69/I.95 — NEYO Intercom signalling.
 * This does not store audio. It stores call state so a call only starts counting
 * after the other user accepts.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { createInApp } from "@/lib/services/notification.service";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import { scopeWhere } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class IntercomError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "OFFLINE" | "BUSY" | "STATE", message: string) {
    super(message);
    this.name = "IntercomError";
  }
}

const STAFF_CALL_ROLES: Role[] = ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "HOD", "DEAN_OF_STUDIES", "TEACHER", "CLASS_TEACHER", "BURSAR", "RECEPTIONIST"];
const CALL_ROLES: Role[] = [...STAFF_CALL_ROLES, "PARENT"];
const TEACHERISH: Role[] = ["TEACHER", "CLASS_TEACHER", "HOD", "DEAN_OF_STUDIES"];
const LEADERSHIP: Role[] = ["SCHOOL_OWNER", "PRINCIPAL", "DEPUTY_PRINCIPAL", "SUPER_ADMIN"];

type DirectoryTarget = { id: string; name: string; role: string; online: boolean };

function rolesOf(user: SessionUser): Role[] {
  return [user.role, user.secondaryRole].filter(Boolean) as Role[];
}
function hasAny(user: SessionUser, roles: Role[]) {
  return rolesOf(user).some((r) => roles.includes(r));
}
function canUseIntercom(user: SessionUser) {
  return hasAny(user, CALL_ROLES);
}
async function isOnline(userId: string) {
  return (await db.session.count({ where: { userId, expiresAt: { gt: new Date() } } })) > 0;
}
async function decorate(users: { id: string; fullName: string; role: string }[]): Promise<DirectoryTarget[]> {
  return Promise.all(users.map(async (u) => ({ id: u.id, name: u.fullName, role: u.role, online: await isOnline(u.id) })));
}

async function parentTeacherTargets(user: SessionUser) {
  const scope = await scopeWhere(user);
  const children = await tenantDb().student.findMany({
    where: { AND: [scope, { status: "ACTIVE", deletedAt: null }] },
    include: { schoolClass: true },
  });
  const classIds = children.map((c) => c.classId).filter(Boolean) as string[];
  if (classIds.length === 0) return [];
  const classes = await tenantDb().schoolClass.findMany({ where: { id: { in: classIds } }, select: { classTeacherId: true } });
  const slots = await tenantDb().timetableSlot.findMany({ where: { classId: { in: classIds } }, select: { teacherId: true } });
  const ids = new Set<string>();
  for (const c of classes) if (c.classTeacherId) ids.add(c.classTeacherId);
  for (const s of slots) if (s.teacherId) ids.add(s.teacherId);
  if (ids.size === 0) return [];
  return tenantDb().user.findMany({ where: { id: { in: [...ids] }, isActive: true }, select: { id: true, fullName: true, role: true }, orderBy: { fullName: "asc" } });
}

async function staffAndParentTargets(user: SessionUser) {
  const targets: { id: string; fullName: string; role: string }[] = [];

  // Staff-to-staff directory.
  const staff = await tenantDb().user.findMany({
    where: { isActive: true, role: { in: STAFF_CALL_ROLES.filter((r) => r !== "SCHOOL_OWNER") } },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
  targets.push(...staff);

  // Staff-to-parent directory. Leadership sees all linked parent users; teachers see own-class parent users.
  let studentWhere: Record<string, unknown> = { status: "ACTIVE", deletedAt: null };
  if (hasAny(user, TEACHERISH) && !hasAny(user, LEADERSHIP)) {
    const allowed = await teacherClassIds(user);
    studentWhere = { ...studentWhere, classId: { in: allowed ?? ["__none__"] } };
  }
  if (hasAny(user, LEADERSHIP) || hasAny(user, TEACHERISH)) {
    const links = await tenantDb().studentGuardian.findMany({
      where: { student: studentWhere, guardian: { userId: { not: null } } },
      include: { guardian: { include: { user: true } } },
      take: 300,
    });
    const parentMap = new Map<string, { id: string; fullName: string; role: string }>();
    for (const l of links) {
      if (l.guardian.user) parentMap.set(l.guardian.user.id, { id: l.guardian.user.id, fullName: `${l.guardian.user.fullName} (Parent)`, role: "PARENT" });
    }
    targets.push(...parentMap.values());
  }

  return targets.filter((u) => u.id !== user.id);
}

async function allowedTargets(user: SessionUser) {
  if (user.role === "PARENT") return parentTeacherTargets(user);
  return staffAndParentTargets(user);
}

export async function intercomBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    if (!canUseIntercom(user)) throw new IntercomError("FORBIDDEN", "Intercom is available to staff and parent accounts with school contacts.");
    const users = await allowedTargets(user);
    const activeCalls = await tenantDb().intercomCall.findMany({
      where: { status: { in: ["RINGING", "ACCEPTED", "QUEUED"] }, OR: [{ callerId: user.id }, { targetId: user.id }] },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return { directory: await decorate(users), activeCalls };
  });
}

async function notifyQueued(call: { tenantId: string; callerId: string; callerName: string; targetId: string; targetName: string }) {
  await createInApp({ tenantId: call.tenantId, recipientId: call.callerId, title: "Intercom queued", body: `${call.targetName} is busy. NEYO will notify you when to call back.`, category: "message", href: "/dashboard" });
  await createInApp({ tenantId: call.tenantId, recipientId: call.targetId, title: "Call waiting", body: `${call.callerName} is waiting to speak to you after your current call.`, category: "message", href: "/dashboard" });
}

async function notifyQueuedAfterEnd(call: { tenantId: string; callerId: string; callerName: string; targetId: string; targetName: string }) {
  await createInApp({ tenantId: call.tenantId, recipientId: call.callerId, title: "Intercom contact is free", body: `${call.targetName} is free now. Tap to call back.`, category: "message", href: "/dashboard" });
  await createInApp({ tenantId: call.tenantId, recipientId: call.targetId, title: "Missed intercom request", body: `${call.callerName} was waiting. You can call back from your dashboard.`, category: "message", href: "/dashboard" });
}

export async function startIntercomCall(user: SessionUser, targetId: string) {
  return withTenant(user.tenantId, async () => {
    if (!canUseIntercom(user)) throw new IntercomError("FORBIDDEN", "Intercom is available to staff and parent accounts with school contacts.");
    if (targetId === user.id) throw new IntercomError("FORBIDDEN", "You cannot call yourself.");

    const allowed = await allowedTargets(user);
    if (!allowed.some((t) => t.id === targetId)) throw new IntercomError("FORBIDDEN", "You cannot call this person from your account.");

    const target = await tenantDb().user.findFirst({ where: { id: targetId, isActive: true } });
    if (!target) throw new IntercomError("NOT_FOUND", "Contact not found.");
    if (!(await isOnline(target.id))) throw new IntercomError("OFFLINE", `${target.fullName} is offline right now.`);

    const busy = await tenantDb().intercomCall.findFirst({
      where: { status: { in: ["RINGING", "ACCEPTED"] }, OR: [{ callerId: target.id }, { targetId: target.id }, { callerId: user.id }, { targetId: user.id }] },
    });

    const call = await tenantDb().intercomCall.create({
      data: {
        callerId: user.id,
        callerName: user.fullName,
        targetId: target.id,
        targetName: target.fullName,
        status: busy ? "QUEUED" : "RINGING",
      } as never,
    });

    if (busy) {
      await notifyQueued(call);
      await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "intercom.call_queued", entityType: "intercomCall", entityId: call.id } });
      return call;
    }

    await createInApp({
      tenantId: user.tenantId,
      recipientId: target.id,
      title: "Incoming intercom call",
      body: `${user.fullName} is calling you. Open the dashboard to accept or decline.`,
      category: "message",
      href: "/dashboard",
    });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "intercom.call_started", entityType: "intercomCall", entityId: call.id } });
    return call;
  });
}

export async function decideIntercomCall(user: SessionUser, callId: string, action: "accept" | "decline" | "end") {
  return withTenant(user.tenantId, async () => {
    const call = await tenantDb().intercomCall.findUnique({ where: { id: callId } });
    if (!call) throw new IntercomError("NOT_FOUND", "Call not found.");
    const isCaller = call.callerId === user.id;
    const isTarget = call.targetId === user.id;
    if (!isCaller && !isTarget) throw new IntercomError("FORBIDDEN", "This is not your call.");

    if (action === "accept") {
      if (!isTarget) throw new IntercomError("FORBIDDEN", "Only the person being called can accept.");
      if (call.status !== "RINGING") throw new IntercomError("STATE", "This call is no longer ringing.");
      return tenantDb().intercomCall.update({ where: { id: call.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } as never });
    }
    if (action === "decline") {
      if (!isTarget) throw new IntercomError("FORBIDDEN", "Only the person being called can decline.");
      if (call.status !== "RINGING") throw new IntercomError("STATE", "This call is no longer ringing.");
      return tenantDb().intercomCall.update({ where: { id: call.id }, data: { status: "DECLINED", endedAt: new Date() } as never });
    }

    if (!["RINGING", "ACCEPTED", "QUEUED"].includes(call.status)) throw new IntercomError("STATE", "This call has already ended.");
    const updated = await tenantDb().intercomCall.update({ where: { id: call.id }, data: { status: call.status === "QUEUED" ? "MISSED" : "ENDED", endedAt: new Date() } as never });

    if (call.status === "ACCEPTED" || call.status === "RINGING") {
      const queued = await tenantDb().intercomCall.findMany({
        where: { status: "QUEUED", OR: [{ targetId: call.callerId }, { targetId: call.targetId }, { callerId: call.callerId }, { callerId: call.targetId }] },
        take: 10,
      });
      for (const q of queued) {
        await notifyQueuedAfterEnd(q);
        await tenantDb().intercomCall.update({ where: { id: q.id }, data: { status: "MISSED", endedAt: new Date() } as never });
      }
    }
    return updated;
  });
}
