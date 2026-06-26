import crypto from "crypto";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { notify } from "@/lib/services/notification.service";
import type { SessionUser } from "@/lib/core/session";

export class OnlineClassError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "STATE", message: string) {
    super(message);
  }
}

const TEACHER_ROLES = new Set(["TEACHER", "CLASS_TEACHER", "HOD", "DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER"]);
function classLabel(c: { level: string; stream: string | null }) { return [c.level, c.stream].filter(Boolean).join(" "); }
function tvCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

async function classRecipientIds(classId: string) {
  const ids = new Set<string>();
  const students = await tenantDb().student.findMany({
    where: { classId, status: "ACTIVE", deletedAt: null },
    include: { guardians: { include: { guardian: true } } },
  });
  for (const st of students) {
    if (st.userId) ids.add(st.userId);
    for (const g of st.guardians) if (g.guardian.userId) ids.add(g.guardian.userId);
  }
  return [...ids];
}

export async function onlineClassBoard(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const [classes, sessions] = await Promise.all([
      tenantDb().schoolClass.findMany({ where: { archived: false }, orderBy: [{ level: "asc" }, { stream: "asc" }] }),
      tenantDb().onlineClassSession.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return {
      classes: classes.map((c) => ({ id: c.id, name: classLabel(c) })),
      sessions,
      runningByClass: sessions.filter((s) => s.status === "RUNNING").map((s) => ({ classId: s.classId, className: s.className, title: s.title, joinUrl: s.joinUrl, tvAccessCode: s.tvAccessCode })),
    };
  });
}

export async function requestOnlineClass(user: SessionUser, input: { classId: string; title: string; scheduledAt: string }) {
  return withTenant(user.tenantId, async () => {
    if (!TEACHER_ROLES.has(user.role) && (!user.secondaryRole || !TEACHER_ROLES.has(user.secondaryRole))) {
      throw new OnlineClassError("FORBIDDEN", "Only teachers and school leadership can request an online live class.");
    }
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls) throw new OnlineClassError("NOT_FOUND", "Class not found.");
    const roomId = `oc_${crypto.randomBytes(8).toString("hex")}`;
    const joinUrl = `/online-classes/join/${roomId}`;
    const row = await db.onlineClassSession.create({
      data: {
        tenantId: user.tenantId,
        classId: cls.id,
        className: classLabel(cls),
        teacherId: user.id,
        teacherName: user.fullName,
        title: input.title,
        scheduledAt: input.scheduledAt,
        roomId,
        joinUrl,
        tvAccessCode: tvCode(),
      },
    });
    const recipients = await classRecipientIds(cls.id);
    for (const id of recipients) {
      await notify({
        tenantId: user.tenantId,
        recipientId: id,
        title: `Online class scheduled: ${row.className}`,
        body: `${user.fullName} scheduled ${row.title}. Join from mobile or classroom TV when it starts.`,
        category: "message",
        href: joinUrl,
        channels: ["in_app", "push"],
      });
    }
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "online_class.requested", entityType: "onlineClassSession", entityId: row.id, metadata: JSON.stringify({ classId: cls.id, recipients: recipients.length }) } });
    return row;
  });
}

export async function joinOnlineClassRoom(user: SessionUser, roomId: string, input: { peerId: string; role?: "TEACHER" | "STUDENT" | "TV" }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    if (row.status === "CANCELLED" || row.status === "ENDED") throw new OnlineClassError("STATE", "This online class is no longer running.");
    const role = input.role || (row.teacherId === user.id ? "TEACHER" : "STUDENT");
    const participant = await db.onlineClassParticipant.upsert({
      where: { peerId: input.peerId },
      create: { tenantId: user.tenantId, sessionId: row.id, userId: user.id, peerId: input.peerId, role, displayName: user.fullName },
      update: { lastSeenAt: new Date(), role, displayName: user.fullName },
    });
    const peers = await tenantDb().onlineClassParticipant.findMany({ where: { sessionId: row.id }, orderBy: { joinedAt: "asc" } });
    await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.peerId, toPeerId: null, type: "join", payload: JSON.stringify({ peerId: input.peerId, role, displayName: user.fullName }) } });
    return { session: row, participant, peers: peers.filter((p) => p.peerId !== input.peerId) };
  });
}

export async function postOnlineClassSignal(user: SessionUser, roomId: string, input: { fromPeerId: string; toPeerId?: string | null; type: "offer" | "answer" | "ice" | "join" | "leave" | "control" | "screen-share"; payload: unknown }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    await db.onlineClassParticipant.updateMany({ where: { tenantId: user.tenantId, sessionId: row.id, peerId: input.fromPeerId }, data: { lastSeenAt: new Date() } });
    const sig = await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.fromPeerId, toPeerId: input.toPeerId || null, type: input.type, payload: JSON.stringify(input.payload ?? {}) } });
    return { id: sig.id };
  });
}

export async function raiseOnlineClassHand(user: SessionUser, roomId: string, input: { peerId: string; question: string }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    const q = await db.onlineClassQuestion.create({ data: { tenantId: user.tenantId, sessionId: row.id, userId: user.id, peerId: input.peerId, studentName: user.fullName, question: input.question.trim() } });
    await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.peerId, toPeerId: null, type: "question", payload: JSON.stringify({ questionId: q.id, peerId: input.peerId, studentName: user.fullName, question: q.question, status: q.status }) } });
    return q;
  });
}

export async function decideOnlineClassQuestion(user: SessionUser, roomId: string, input: { fromPeerId: string; questionId: string; status: "APPROVED" | "DISMISSED" }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    if (row.teacherId !== user.id && !["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER"].includes(user.role)) throw new OnlineClassError("FORBIDDEN", "Only the teacher can approve class questions.");
    const q = await tenantDb().onlineClassQuestion.findUnique({ where: { id: input.questionId } });
    if (!q || q.sessionId !== row.id) throw new OnlineClassError("NOT_FOUND", "Question not found.");
    const updated = await db.onlineClassQuestion.update({ where: { id: q.id }, data: { status: input.status, approvedById: user.id, approvedByName: user.fullName, approvedAt: new Date() } });
    await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.fromPeerId, toPeerId: q.peerId, type: "question-decision", payload: JSON.stringify({ questionId: q.id, status: input.status, approvedSpeakerPeerId: input.status === "APPROVED" ? q.peerId : null }) } });
    if (input.status === "APPROVED") {
      await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.fromPeerId, toPeerId: null, type: "control", payload: JSON.stringify({ approvedSpeakerPeerId: q.peerId, muteAllStudents: row.muteAllStudents, studentVideoDisabled: row.studentVideoDisabled, screenSharePeerId: row.screenSharePeerId, recordingAllowed: row.recordingAllowed }) } });
    }
    return updated;
  });
}

export async function pollOnlineClassSignals(user: SessionUser, roomId: string, peerId: string, sinceId?: string | null) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    await db.onlineClassParticipant.updateMany({ where: { tenantId: user.tenantId, sessionId: row.id, peerId }, data: { lastSeenAt: new Date() } });
    const signals = await tenantDb().onlineClassSignal.findMany({
      where: { sessionId: row.id, OR: [{ toPeerId: peerId }, { toPeerId: null }], NOT: { fromPeerId: peerId } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    const filtered = sinceId ? signals.filter((s) => s.id > sinceId) : signals;
    const [peers, questions] = await Promise.all([
      tenantDb().onlineClassParticipant.findMany({ where: { sessionId: row.id }, orderBy: { joinedAt: "asc" } }),
      tenantDb().onlineClassQuestion.findMany({ where: { sessionId: row.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return { session: row, peers, questions, signals: filtered.map((s) => ({ ...s, payload: JSON.parse(s.payload) })) };
  });
}

export async function updateOnlineClassControls(user: SessionUser, roomId: string, input: { fromPeerId: string; muteAllStudents?: boolean; studentVideoDisabled?: boolean; screenSharePeerId?: string | null; recordingAllowed?: boolean }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { roomId } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class room not found.");
    if (row.teacherId !== user.id && !["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER"].includes(user.role)) throw new OnlineClassError("FORBIDDEN", "Only the teacher or school leadership can control this online class.");
    const updated = await db.onlineClassSession.update({
      where: { id: row.id },
      data: {
        ...(input.muteAllStudents !== undefined ? { muteAllStudents: input.muteAllStudents } : {}),
        ...(input.studentVideoDisabled !== undefined ? { studentVideoDisabled: input.studentVideoDisabled } : {}),
        ...(input.screenSharePeerId !== undefined ? { screenSharePeerId: input.screenSharePeerId } : {}),
        ...(input.recordingAllowed !== undefined ? { recordingAllowed: input.recordingAllowed } : {}),
      },
    });
    await db.onlineClassSignal.create({ data: { tenantId: user.tenantId, sessionId: row.id, fromPeerId: input.fromPeerId, toPeerId: null, type: "control", payload: JSON.stringify({ muteAllStudents: updated.muteAllStudents, studentVideoDisabled: updated.studentVideoDisabled, screenSharePeerId: updated.screenSharePeerId, recordingAllowed: updated.recordingAllowed }) } });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "online_class.controls_updated", entityType: "onlineClassSession", entityId: row.id, metadata: JSON.stringify({ muteAllStudents: updated.muteAllStudents, studentVideoDisabled: updated.studentVideoDisabled, screenSharePeerId: updated.screenSharePeerId, recordingAllowed: updated.recordingAllowed }) } });
    return updated;
  });
}

export async function setOnlineClassStatus(user: SessionUser, id: string, status: "RUNNING" | "ENDED" | "CANCELLED") {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().onlineClassSession.findUnique({ where: { id } });
    if (!row) throw new OnlineClassError("NOT_FOUND", "Online class not found.");
    if (row.teacherId !== user.id && !["PRINCIPAL", "DEPUTY_PRINCIPAL", "SCHOOL_OWNER"].includes(user.role)) throw new OnlineClassError("FORBIDDEN", "Only the requesting teacher or school leadership can update this online class.");
    const updated = await db.onlineClassSession.update({
      where: { id },
      data: { status, startedAt: status === "RUNNING" ? new Date() : row.startedAt, endedAt: status === "ENDED" || status === "CANCELLED" ? new Date() : row.endedAt },
    });
    if (status === "RUNNING") {
      const recipients = await classRecipientIds(row.classId);
      for (const rid of recipients) {
        await notify({ tenantId: user.tenantId, recipientId: rid, title: `Online class running in ${row.className}`, body: `${row.title} is live now. Join from phone, TV or computer.`, category: "message", href: row.joinUrl, channels: ["in_app", "push"] });
      }
    }
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: `online_class.${status.toLowerCase()}`, entityType: "onlineClassSession", entityId: row.id } });
    return updated;
  });
}
