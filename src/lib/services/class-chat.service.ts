/**
 * G.19 Class Group Chat (founder-requested 2026-06-12).
 * ONE auto-provisioned GROUP conversation per class on the A.8 engine:
 * members = class teacher + leadership + the class's guardian PARENT logins +
 * the class's STUDENT logins. Membership SYNCS on open (new families join
 * automatically, transfers drop off). Reuses all A.8 plumbing: messages,
 * attachments, unread counts, ⌘K, SSE.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import { scopeWhere } from "@/lib/services/student.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class ClassChatError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "ClassChatError";
  }
}

const classLabel = (c: { level: string; stream: string | null }) =>
  [c.level, c.stream].filter(Boolean).join(" ");

/** Everyone who SHOULD be in a class's group chat right now. */
async function chatMemberIds(classId: string): Promise<string[]> {
  const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
  if (!cls) throw new ClassChatError("NOT_FOUND", "Class not found.");

  const ids = new Set<string>();
  if (cls.classTeacherId) ids.add(cls.classTeacherId);

  // Subject teachers on the timetable.
  const slots = await tenantDb().timetableSlot.findMany({
    where: { classId }, select: { teacherId: true },
  });
  for (const s of slots) if (s.teacherId) ids.add(s.teacherId);

  // Guardian PARENT logins + STUDENT logins of active students in the class.
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

/** May this user be in this class's chat? */
async function canJoin(user: SessionUser, classId: string): Promise<boolean> {
  const role = user.role as Role;
  if (role === "STUDENT" || role === "PARENT") {
    const scope = await scopeWhere(user);
    const child = await tenantDb().student.findFirst({ where: { AND: [scope, { classId, status: "ACTIVE", deletedAt: null }] } });
    return Boolean(child);
  }
  const allowed = await teacherClassIds(user); // null = leadership (always allowed)
  return allowed === null || allowed.includes(classId);
}

/**
 * Get-or-create the class group chat + SYNC membership.
 * Returns the conversationId for /messages deep-linking.
 */
export async function openClassChat(user: SessionUser, classId: string) {
  return withTenant(user.tenantId, async () => {
    if (!(await canJoin(user, classId)))
      throw new ClassChatError("FORBIDDEN", "You are not part of this class.");

    const cls = await tenantDb().schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new ClassChatError("NOT_FOUND", "Class not found.");

    let convo = await tenantDb().conversation.findFirst({ where: { classId } });
    if (!convo) {
      convo = await db.conversation.create({
        data: {
          tenantId: user.tenantId,
          type: "GROUP",
          title: `${classLabel(cls)} — Class Group`,
          classId,
          createdById: user.id,
        },
      });
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
          action: "classchat.created", entityType: "conversation", entityId: convo.id,
          metadata: JSON.stringify({ class: classLabel(cls) }),
        },
      });
    }

    // SYNC membership: add missing members, drop people no longer in the class.
    const shouldBe = new Set(await chatMemberIds(classId));
    shouldBe.add(user.id); // the opener is always legitimate (canJoin passed)
    const current = await db.conversationParticipant.findMany({ where: { conversationId: convo.id } });
    const currentIds = new Set(current.map((p) => p.userId));

    const toAdd = [...shouldBe].filter((id) => !currentIds.has(id));
    if (toAdd.length) {
      await db.conversationParticipant.createMany({
        data: toAdd.map((uid) => ({
          conversationId: convo!.id, userId: uid, role: "member",
          lastReadAt: uid === user.id ? new Date() : null,
        })),
      });
    }
    const toRemove = current.filter((p) => !shouldBe.has(p.userId));
    if (toRemove.length) {
      await db.conversationParticipant.deleteMany({ where: { id: { in: toRemove.map((p) => p.id) } } });
    }

    return { conversationId: convo.id, title: convo.title, added: toAdd.length, removed: toRemove.length };
  });
}
