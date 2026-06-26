/**
 * G.16 Year-End Promotion Engine + Stream Reshuffle.
 *
 * PROMOTION: builds a preview plan (Form 1 East -> Form 2 East...), commit
 * moves every ACTIVE student up; FINAL-YEAR cohorts graduate via the B.1
 * alumni fields (graduationYear + finalClassLabel). Every move is logged on a
 * PromotionRun row so the whole run can be UNDONE.
 *
 * RESHUFFLE: redistributes one level's students across its streams —
 * strategies: size (round-robin by count) | gender (balanced boy/girl) |
 * alpha (surname A→Z round-robin). "performance" intentionally NOT offered
 * until B.5 exam marks exist (no fake data — Prompt 2).
 *
 * Levels understood (KE): "Form N" (8-4-4, final 4), "Grade N" (CBC, final 9),
 * "PP N" (pre-primary, PP2 -> Grade 1). Unknown level patterns are listed as
 * `unmapped` in the preview and SKIPPED on commit (never guess).
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { tenantDb } from "@/lib/core/tenant-db";
import type { SessionUser } from "@/lib/core/session";

export class PromotionError extends Error {
  constructor(public code: "NOT_FOUND" | "EMPTY" | "CONFLICT", message: string) {
    super(message);
    this.name = "PromotionError";
  }
}

// ---------------------------------------------------------------------------
// Level parsing (KE structures)
// ---------------------------------------------------------------------------

interface ParsedLevel { kind: "form" | "grade" | "pp"; n: number }

export function parseLevel(level: string): ParsedLevel | null {
  const s = level.trim().toLowerCase();
  let m = s.match(/^form\s*(\d{1,2})$/);
  if (m) return { kind: "form", n: Number(m[1]) };
  m = s.match(/^grade\s*(\d{1,2})$/);
  if (m) return { kind: "grade", n: Number(m[1]) };
  m = s.match(/^pp\s*(\d)$/);
  if (m) return { kind: "pp", n: Number(m[1]) };
  return null;
}

/** Next level up, or "graduate" for final years, or null if unknown. */
export function nextLevel(level: string): string | "graduate" | null {
  const p = parseLevel(level);
  if (!p) return null;
  if (p.kind === "form") return p.n >= 4 ? "graduate" : `Form ${p.n + 1}`;
  if (p.kind === "grade") return p.n >= 9 ? "graduate" : `Grade ${p.n + 1}`;
  // PP1 -> PP2 -> Grade 1
  return p.n >= 2 ? "Grade 1" : `PP ${p.n + 1}`;
}

interface Move {
  studentId: string;
  fromClassId: string | null;
  toClassId: string | null;
  graduated?: boolean;
  prevStatus?: string;
  prevGradYear?: number | null;
  prevFinalLabel?: string | null;
}

// ---------------------------------------------------------------------------
// Promotion preview + commit
// ---------------------------------------------------------------------------

export async function promotionPlan(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const classes = await tenantDb().schoolClass.findMany({
      where: { archived: false },
      orderBy: [{ level: "asc" }, { stream: "asc" }],
    });
    const plan: {
      classId: string; from: string; to: string | null; graduate: boolean;
      students: number; toExists: boolean;
    }[] = [];
    const unmapped: string[] = [];

    for (const c of classes) {
      const label = [c.level, c.stream].filter(Boolean).join(" ");
      const count = await tenantDb().student.count({ where: { classId: c.id, status: "ACTIVE" } });
      const next = nextLevel(c.level);
      if (next === null) { unmapped.push(label); continue; }
      if (next === "graduate") {
        plan.push({ classId: c.id, from: label, to: null, graduate: true, students: count, toExists: true });
        continue;
      }
      const target = classes.find((t) => t.level === next && (t.stream ?? null) === (c.stream ?? null));
      plan.push({
        classId: c.id,
        from: label,
        to: [next, c.stream].filter(Boolean).join(" "),
        graduate: false,
        students: count,
        toExists: Boolean(target),
      });
    }
    return { plan, unmapped, totalStudents: plan.reduce((a, p) => a + p.students, 0) };
  });
}

/** Commit the new academic year. Processes top level first (no collisions). */
export async function commitPromotion(user: SessionUser, graduationYear?: number) {
  return withTenant(user.tenantId, async () => {
    const { plan } = await promotionPlan(user);
    if (plan.length === 0) throw new PromotionError("EMPTY", "No classes to promote.");

    const classes = await tenantDb().schoolClass.findMany({ where: { archived: false } });
    const byKey = new Map(classes.map((c) => [`${c.level}|${c.stream ?? ""}`, c]));
    const year = graduationYear ?? new Date().getFullYear();
    const moves: Move[] = [];
    let promoted = 0;
    let graduated = 0;

    // Highest levels first so we never promote a student twice in one run.
    const ordered = [...plan].sort((a, b) => {
      const pa = parseLevel(classes.find((c) => c.id === a.classId)!.level)!;
      const pb = parseLevel(classes.find((c) => c.id === b.classId)!.level)!;
      const rank = (p: ParsedLevel) => (p.kind === "pp" ? p.n : p.kind === "grade" ? 10 + p.n : 30 + p.n);
      return rank(pb) - rank(pa);
    });

    for (const step of ordered) {
      const students = await tenantDb().student.findMany({
        where: { classId: step.classId, status: "ACTIVE" },
        select: { id: true, status: true, graduationYear: true, finalClassLabel: true },
      });
      if (students.length === 0) continue;

      if (step.graduate) {
        for (const s of students) {
          moves.push({ studentId: s.id, fromClassId: step.classId, toClassId: null, graduated: true, prevStatus: s.status, prevGradYear: s.graduationYear, prevFinalLabel: s.finalClassLabel });
        }
        await tenantDb().student.updateMany({
          where: { id: { in: students.map((s) => s.id) } },
          data: { status: "GRADUATED", graduationYear: year, finalClassLabel: step.from, classId: null },
        });
        graduated += students.length;
        continue;
      }

      // Resolve/create destination class (same stream, level+1).
      const src = classes.find((c) => c.id === step.classId)!;
      const destLevel = step.to!.replace(src.stream ? ` ${src.stream}` : "", "").trim();
      const key = `${destLevel}|${src.stream ?? ""}`;
      let dest = byKey.get(key);
      if (!dest) {
        dest = await tenantDb().schoolClass.create({
          data: { level: destLevel, stream: src.stream, curriculum: src.curriculum } as never,
        });
        byKey.set(key, dest);
      }
      for (const s of students) moves.push({ studentId: s.id, fromClassId: step.classId, toClassId: dest.id });
      await tenantDb().student.updateMany({
        where: { id: { in: students.map((s) => s.id) } },
        data: { classId: dest.id },
      });
      promoted += students.length;
    }

    const summary = `New year: ${promoted} promoted, ${graduated} graduated (Class of ${year})`;
    const run = await tenantDb().promotionRun.create({
      data: { kind: "promotion", summary, moves: JSON.stringify(moves), createdById: user.id, createdByName: user.fullName } as never,
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "promotion.committed", entityType: "promotionRun", entityId: run.id,
        metadata: JSON.stringify({ promoted, graduated, year }),
      },
    });
    return { runId: run.id, promoted, graduated, year, summary };
  });
}

// ---------------------------------------------------------------------------
// Stream reshuffle
// ---------------------------------------------------------------------------

export type ReshuffleStrategy = "size" | "gender" | "alpha";

export async function reshufflePlan(user: SessionUser, level: string, strategy: ReshuffleStrategy) {
  return withTenant(user.tenantId, async () => {
    const streams = await tenantDb().schoolClass.findMany({
      where: { level, archived: false },
      orderBy: { stream: "asc" },
    });
    if (streams.length < 2) throw new PromotionError("CONFLICT", "This level has fewer than two streams — nothing to reshuffle.");
    const students = await tenantDb().student.findMany({
      where: { classId: { in: streams.map((s) => s.id) }, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, gender: true, classId: true },
    });
    if (students.length === 0) throw new PromotionError("EMPTY", "No active students in this level.");

    // Order according to strategy, then deal round-robin (snake for gender fairness).
    let ordered = [...students];
    if (strategy === "gender") {
      const boys = students.filter((s) => s.gender === "M");
      const girls = students.filter((s) => s.gender === "F");
      ordered = [];
      const max = Math.max(boys.length, girls.length);
      for (let i = 0; i < max; i++) {
        if (boys[i]) ordered.push(boys[i]);
        if (girls[i]) ordered.push(girls[i]);
      }
    }
    // "alpha" + "size" both use the surname ordering above; the round-robin
    // deal is what balances sizes.

    const assignment = new Map<string, string>(); // studentId -> classId
    ordered.forEach((s, i) => {
      assignment.set(s.id, streams[i % streams.length].id);
    });

    const preview = streams.map((st) => {
      const ids = [...assignment.entries()].filter(([, cid]) => cid === st.id).map(([sid]) => sid);
      const members = students.filter((s) => ids.includes(s.id));
      return {
        classId: st.id,
        label: [st.level, st.stream].filter(Boolean).join(" "),
        count: members.length,
        boys: members.filter((m) => m.gender === "M").length,
        girls: members.filter((m) => m.gender === "F").length,
        students: members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, gender: m.gender, moved: m.classId !== st.id })),
      };
    });
    const movedCount = students.filter((s) => assignment.get(s.id) !== s.classId).length;
    return { level, strategy, streams: preview, movedCount, total: students.length };
  });
}

export async function commitReshuffle(user: SessionUser, level: string, strategy: ReshuffleStrategy) {
  return withTenant(user.tenantId, async () => {
    const plan = await reshufflePlan(user, level, strategy);
    const moves: Move[] = [];
    for (const stream of plan.streams) {
      for (const s of stream.students) {
        if (!s.moved) continue;
        const current = await tenantDb().student.findUnique({ where: { id: s.id }, select: { classId: true } });
        moves.push({ studentId: s.id, fromClassId: current?.classId ?? null, toClassId: stream.classId });
        await tenantDb().student.update({ where: { id: s.id }, data: { classId: stream.classId } });
      }
    }
    const summary = `Reshuffled ${level}: ${moves.length} of ${plan.total} students moved (${strategy})`;
    const run = await tenantDb().promotionRun.create({
      data: { kind: "reshuffle", summary, moves: JSON.stringify(moves), createdById: user.id, createdByName: user.fullName } as never,
    });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "promotion.reshuffled", entityType: "promotionRun", entityId: run.id,
        metadata: JSON.stringify({ level, strategy, moved: moves.length }),
      },
    });
    return { runId: run.id, moved: moves.length, summary };
  });
}

// ---------------------------------------------------------------------------
// History + undo
// ---------------------------------------------------------------------------

export async function listRuns(user: SessionUser) {
  return withTenant(user.tenantId, async () => {
    const rows = await tenantDb().promotionRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return rows.map((r) => ({
      id: r.id, kind: r.kind, summary: r.summary, undoneAt: r.undoneAt,
      createdByName: r.createdByName, createdAt: r.createdAt,
      moves: (JSON.parse(r.moves) as Move[]).length,
    }));
  });
}

/** Undo a run: every move reversed (class restored; graduations reverted). */
export async function undoRun(user: SessionUser, runId: string) {
  return withTenant(user.tenantId, async () => {
    const run = await tenantDb().promotionRun.findUnique({ where: { id: runId } });
    if (!run) throw new PromotionError("NOT_FOUND", "Run not found.");
    if (run.undoneAt) throw new PromotionError("CONFLICT", "This run was already undone.");

    const moves = JSON.parse(run.moves) as Move[];
    for (const m of moves) {
      if (m.graduated) {
        await tenantDb().student.update({
          where: { id: m.studentId },
          data: {
            status: m.prevStatus ?? "ACTIVE",
            graduationYear: m.prevGradYear ?? null,
            finalClassLabel: m.prevFinalLabel ?? null,
            classId: m.fromClassId,
          },
        });
      } else {
        await tenantDb().student.update({ where: { id: m.studentId }, data: { classId: m.fromClassId } });
      }
    }
    await tenantDb().promotionRun.update({ where: { id: runId }, data: { undoneAt: new Date() } });
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.fullName,
        action: "promotion.undone", entityType: "promotionRun", entityId: runId,
        metadata: JSON.stringify({ reversedMoves: moves.length }),
      },
    });
    return { reversed: moves.length };
  });
}
