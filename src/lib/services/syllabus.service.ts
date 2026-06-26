import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { can } from "@/lib/core/permissions";
import { teacherClassIds } from "@/lib/services/teacher-portal.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

export class SyllabusError extends Error {
  constructor(public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "SyllabusError";
  }
}

function classLabel(c: { level: string; stream: string | null }) {
  return [c.level, c.stream].filter(Boolean).join(" ");
}

function todayYmd() {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

async function allowedClassFilter(user: SessionUser) {
  const allowed = await teacherClassIds(user);
  return allowed === null ? {} : { id: { in: allowed } };
}

async function assertCanWrite(user: SessionUser, classId?: string) {
  const allowed = await teacherClassIds(user);
  const primaryCanManage = can(user.role as Role, "academics.manage");
  const secondaryCanManage = user.secondaryRole ? can(user.secondaryRole as Role, "academics.manage") : false;
  if (primaryCanManage || secondaryCanManage) return;
  if (allowed !== null && classId && allowed.includes(classId)) return;
  throw new SyllabusError("FORBIDDEN", "Only Academics leadership or the teacher assigned to this class can update syllabus coverage.");
}

export async function syllabusBoard(user: SessionUser, filters: { classId?: string; subjectId?: string; status?: string } = {}) {
  return withTenant(user.tenantId, async () => {
    const classFilter = await allowedClassFilter(user);
    const classes = await tenantDb().schoolClass.findMany({
      where: { archived: false, ...classFilter },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });
    const classIds = classes.map((c) => c.id);
    const subjects = await tenantDb().subject.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
    const terms = await tenantDb().academicTerm.findMany({ orderBy: [{ year: "desc" }, { term: "desc" }], take: 9 });

    const topicWhere: Record<string, unknown> = { classId: { in: classIds } };
    if (filters.classId) topicWhere.classId = filters.classId;
    if (filters.subjectId) topicWhere.subjectId = filters.subjectId;
    if (filters.status) topicWhere.status = filters.status;

    const rows = await tenantDb().syllabusTopic.findMany({
      where: topicWhere,
      orderBy: [{ deadline: "asc" }, { topic: "asc" }],
      take: 300,
    });

    const cMap = new Map(classes.map((c) => [c.id, classLabel(c)]));
    const sMap = new Map(subjects.map((s) => [s.id, `${s.name} (${s.code})`]));
    const today = todayYmd();
    const topics = rows.map((r) => {
      const effectiveStatus = r.status !== "COVERED" && r.deadline < today ? "LATE" : r.status;
      return {
        id: r.id,
        classId: r.classId,
        className: cMap.get(r.classId) ?? "—",
        subjectId: r.subjectId,
        subjectName: sMap.get(r.subjectId) ?? "—",
        termId: r.termId,
        topic: r.topic,
        scopeRef: r.scopeRef,
        deadline: r.deadline,
        status: effectiveStatus,
        coveredAt: r.coveredAt,
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        notes: r.notes,
      };
    });

    const total = topics.length;
    const covered = topics.filter((t) => t.status === "COVERED").length;
    const late = topics.filter((t) => t.status === "LATE").length;
    const inProgress = topics.filter((t) => t.status === "IN_PROGRESS").length;
    const coveragePct = total ? Math.round((covered / total) * 100) : 0;

    return {
      classes: classes.map((c) => ({ id: c.id, name: classLabel(c), level: c.level, stream: c.stream })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      terms: terms.map((t) => ({ id: t.id, label: `Term ${t.term} ${t.year}`, current: t.current })),
      summary: { total, covered, late, inProgress, coveragePct },
      topics,
    };
  });
}

export async function createSyllabusTopic(user: SessionUser, input: { classId: string; subjectId: string; termId?: string; topic: string; scopeRef?: string; deadline: string; teacherId?: string; notes?: string }) {
  return withTenant(user.tenantId, async () => {
    await assertCanWrite(user, input.classId);
    const cls = await tenantDb().schoolClass.findUnique({ where: { id: input.classId } });
    if (!cls) throw new SyllabusError("NOT_FOUND", "Class not found.");
    const subject = await tenantDb().subject.findUnique({ where: { id: input.subjectId } });
    if (!subject) throw new SyllabusError("NOT_FOUND", "Subject not found.");
    const teacher = input.teacherId ? await tenantDb().user.findUnique({ where: { id: input.teacherId } }) : null;
    const row = await tenantDb().syllabusTopic.create({
      data: {
        classId: input.classId,
        subjectId: input.subjectId,
        termId: input.termId || null,
        topic: input.topic,
        scopeRef: input.scopeRef || null,
        deadline: input.deadline,
        teacherId: teacher?.id ?? null,
        teacherName: teacher?.fullName ?? null,
        notes: input.notes || null,
        createdById: user.id,
        createdByName: user.fullName,
      } as never,
    });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "syllabus.topic_created", entityType: "syllabusTopic", entityId: row.id, metadata: JSON.stringify({ class: classLabel(cls), subject: subject.name, topic: input.topic }) } });
    return row;
  });
}

export async function updateSyllabusTopic(user: SessionUser, input: { id: string; status: string; notes?: string }) {
  return withTenant(user.tenantId, async () => {
    const row = await tenantDb().syllabusTopic.findUnique({ where: { id: input.id } });
    if (!row) throw new SyllabusError("NOT_FOUND", "Topic not found.");
    await assertCanWrite(user, row.classId);
    const updated = await tenantDb().syllabusTopic.update({
      where: { id: row.id },
      data: {
        status: input.status,
        notes: input.notes ?? row.notes,
        coveredAt: input.status === "COVERED" ? new Date() : null,
      } as never,
    });
    await db.auditLog.create({ data: { tenantId: user.tenantId, actorId: user.id, actorName: user.fullName, action: "syllabus.topic_updated", entityType: "syllabusTopic", entityId: row.id, metadata: JSON.stringify({ status: input.status }) } });
    return updated;
  });
}
