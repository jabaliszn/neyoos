/**
 * B.6 CBC Management — service.
 * Strands per subject (with KICD presets), teacher formative assessments on
 * the 4-point rubric (row-scoped like everything else), per-learner
 * competency aggregation, and the KICD-format report data.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import { scopeWhere } from "@/lib/services/student.service";
import { LEVEL_LABELS } from "@/lib/validations/cbc";
import type { SessionUser } from "@/lib/core/session";

export class CbcError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "CbcError";
  }
}

async function audit(user: SessionUser, action: string, entityId: string, metadata?: unknown) {
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
      action, entityType: "cbc", entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Strands (B.6.1/2)
// ---------------------------------------------------------------------------

export async function listStrands(user: SessionUser, subjectId?: string) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().cbcStrand.findMany({
      where: subjectId ? { subjectId } : {},
      orderBy: { name: "asc" },
      include: { _count: { select: { assessments: true } } },
    });
    const subjects = await tenantDb().subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId))] } } });
    const sMap = new Map(subjects.map((s) => [s.id, s]));
    return rows.map((r) => ({
      id: r.id, name: r.name, learningOutcome: r.learningOutcome,
      subjectId: r.subjectId, subjectName: sMap.get(r.subjectId)?.name ?? "—",
      subjectCode: sMap.get(r.subjectId)?.code ?? "", assessmentCount: r._count.assessments,
    }));
  });
}

export async function createStrand(user: SessionUser, input: { subjectId: string; name: string; learningOutcome?: string }) {
  return withTenant(user.tenantId, async () => {
    const dup = await tenantDb().cbcStrand.findFirst({ where: { subjectId: input.subjectId, name: input.name } });
    if (dup) throw new CbcError("DUPLICATE", `Strand "${input.name}" already exists for this learning area.`);
    const s = await tenantDb().cbcStrand.create({
      data: { subjectId: input.subjectId, name: input.name, learningOutcome: input.learningOutcome || null } as never,
    });
    await audit(user, "cbc.strand_created", s.id, { name: input.name });
    return s;
  });
}

/** Quick-add KICD strands for a subject (skips existing names). */
export async function addStrandPreset(user: SessionUser, subjectId: string, preset: { name: string; learningOutcome: string }[]) {
  return withTenant(user.tenantId, async () => {
    const existing = new Set((await tenantDb().cbcStrand.findMany({ where: { subjectId }, select: { name: true } })).map((s) => s.name));
    let added = 0;
    for (const p of preset) {
      if (existing.has(p.name)) continue;
      await tenantDb().cbcStrand.create({ data: { subjectId, name: p.name, learningOutcome: p.learningOutcome } as never });
      added++;
    }
    await audit(user, "cbc.preset_added", subjectId, { added });
    return { added, skipped: preset.length - added };
  });
}

// ---------------------------------------------------------------------------
// Formative assessments (B.6.5) — teacher row-scoped
// ---------------------------------------------------------------------------

/** Class sheet for one strand: students + their LATEST level on it. */
export async function getAssessSheet(user: SessionUser, strandId: string, classId: string) {
  return withTenant(user.tenantId, async () => {
    const strand = await tenantDb().cbcStrand.findUnique({ where: { id: strandId } });
    if (!strand) throw new CbcError("NOT_FOUND", "Strand not found.");
    const scope = await scopeWhere(user);
    const students = await tenantDb().student.findMany({
      where: { AND: [scope, { classId, status: "ACTIVE" }] },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, middleName: true, lastName: true, admissionNo: true },
    });
    if (students.length === 0) throw new CbcError("FORBIDDEN", "No students here (or not your class).");
    const latest = await tenantDb().cbcAssessment.findMany({
      where: { strandId, studentId: { in: students.map((s) => s.id) } },
      orderBy: { createdAt: "desc" },
    });
    const seen = new Map<string, { level: number; date: string; comment: string | null }>();
    for (const a of latest) if (!seen.has(a.studentId)) seen.set(a.studentId, { level: a.level, date: a.date, comment: a.comment });
    return {
      strand: { id: strand.id, name: strand.name, learningOutcome: strand.learningOutcome },
      students: students.map((s) => ({
        id: s.id,
        name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
        admissionNo: s.admissionNo,
        latest: seen.get(s.id) ?? null,
      })),
    };
  });
}

/** Record a round of observations (one row per student per save — history kept). */
export async function saveAssessments(user: SessionUser, input: { strandId: string; date: string; entries: { studentId: string; level: number | null; comment?: string }[] }, classId: string) {
  return withTenant(user.tenantId, async () => {
    const strand = await tenantDb().cbcStrand.findUnique({ where: { id: input.strandId } });
    if (!strand) throw new CbcError("NOT_FOUND", "Strand not found.");
    const scope = await scopeWhere(user);
    const allowed = new Set(
      (await tenantDb().student.findMany({ where: { AND: [scope, { classId, status: "ACTIVE" }] }, select: { id: true } })).map((s) => s.id)
    );
    let saved = 0;
    for (const e of input.entries) {
      if (e.level === null || !allowed.has(e.studentId)) continue;
      await tenantDb().cbcAssessment.create({
        data: {
          studentId: e.studentId, strandId: input.strandId, level: e.level,
          comment: e.comment || null, date: input.date,
          teacherId: user.id, teacherName: user.fullName,
        } as never,
      });
      saved++;
    }
    await audit(user, "cbc.assessed", input.strandId, { date: input.date, saved });
    return { saved };
  });
}

// ---------------------------------------------------------------------------
// Competency tracking + reports (B.6.1/3/6)
// ---------------------------------------------------------------------------

/** Per-learner competency profile: latest level per strand, grouped by subject. */
export async function studentCompetencies(user: SessionUser, studentId: string) {
  return withTenant(user.tenantId, async () => {
    const scope = await scopeWhere(user);
    const student = await tenantDb().student.findFirst({ where: { AND: [{ id: studentId }, scope] }, include: { schoolClass: true } });
    if (!student) throw new CbcError("NOT_FOUND", "Student not found.");

    const assessments = await tenantDb().cbcAssessment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { strand: true },
    });
    // latest per strand
    const latest = new Map<string, typeof assessments[number]>();
    for (const a of assessments) if (!latest.has(a.strandId)) latest.set(a.strandId, a);

    const subjects = await tenantDb().subject.findMany({
      where: { id: { in: [...new Set([...latest.values()].map((a) => a.strand.subjectId))] } },
    });
    const bySubject = subjects.map((sub) => {
      const strands = [...latest.values()]
        .filter((a) => a.strand.subjectId === sub.id)
        .map((a) => ({
          strandId: a.strandId,
          strand: a.strand.name,
          learningOutcome: a.strand.learningOutcome,
          level: a.level,
          code: LEVEL_LABELS[a.level].code,
          label: LEVEL_LABELS[a.level].label,
          parentFriendly: LEVEL_LABELS[a.level].parent,
          comment: a.comment,
          date: a.date,
          teacherName: a.teacherName,
        }))
        .sort((x, y) => x.strand.localeCompare(y.strand));
      const avg = strands.length ? strands.reduce((s, x) => s + x.level, 0) / strands.length : 0;
      return {
        subjectId: sub.id, subject: sub.name, code: sub.code,
        strands, avgLevel: Math.round(avg * 10) / 10,
        overall: LEVEL_LABELS[Math.max(1, Math.min(4, Math.round(avg)))].code,
      };
    }).filter((s) => s.strands.length > 0)
      .sort((a, b) => b.avgLevel - a.avgLevel);

    return {
      student: {
        id: student.id,
        name: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNo: student.admissionNo,
        className: student.schoolClass ? [student.schoolClass.level, student.schoolClass.stream].filter(Boolean).join(" ") : null,
      },
      subjects: bySubject,
      totalAssessments: assessments.length,
    };
  });
}
