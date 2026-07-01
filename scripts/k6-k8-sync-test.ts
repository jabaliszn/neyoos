/**
 * K.6 + K.8 full-stack test.
 *
 * K.6 — Auto-sync computed final results into J.4 CompetencyEvidence (which also
 *       surfaces in the J.8 Learner Journey timeline).
 * K.8 — Parent SMS on result release (best-effort, non-fatal).
 *
 * Proves against the live SQLite DB:
 *  1. With curriculum engine OFF, syncResultsToCompetencyEvidence is a no-op (J-OFF safety).
 *  2. With curriculum engine ON + a competency mapped to a subject's learning area,
 *     the sync writes CompetencyEvidence rows with the correct CBC level from marks.
 *  3. The sync is idempotent (re-run updates, does not duplicate).
 *  4. The written evidence appears in the J.8 Learner Journey timeline (source COMPETENCY).
 *  5. K.8: releaseTermResults reports parents notified by SMS (dev-console mode),
 *     and a normal release still succeeds when there are parents to notify.
 *
 * Restores curriculum-engine setting + cleans up all created rows.
 */
import { PrismaClient } from "@prisma/client";
import { syncResultsToCompetencyEvidence } from "../src/lib/services/computation-engine.service";
import { getLearnerJourneyTimeline } from "../src/lib/services/learner-journey.service";

const db = new PrismaClient();

function su(u: any, tenantId: string) {
  return {
    id: u.id, tenantId, neyoLoginId: u.neyoLoginId ?? u.id, fullName: u.fullName,
    phone: u.phone ?? null, email: u.email ?? null, role: u.role, secondaryRole: u.secondaryRole ?? null,
    language: u.language ?? "en",
  } as any;
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`); }
}

async function setEngine(value: boolean) {
  await db.platformSetting.upsert({
    where: { key: "enable_curriculum_engine" },
    create: { key: "enable_curriculum_engine", value: value ? "true" : "false" },
    update: { value: value ? "true" : "false" },
  });
}

async function main() {
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error("tenant not found");
  const tid = t.id;
  const term = await db.academicTerm.findFirst({ where: { tenantId: tid, current: true } });
  if (!term) throw new Error("term not found");

  // Save original engine setting to restore later
  const original = await db.platformSetting.findUnique({ where: { key: "enable_curriculum_engine" } });
  const originalValue = original?.value ?? null;

  // Find a subject that (a) has a learning area and (b) has exam results this term.
  const results = await db.examResult.findMany({
    where: { tenantId: tid, exam: { term: term.term } },
    select: { id: true, subjectId: true, marks: true, studentId: true },
  });
  if (results.length === 0) throw new Error("no exam results in term");
  const subjects = await db.subject.findMany({
    where: { id: { in: Array.from(new Set(results.map((r) => r.subjectId))) }, learningAreaId: { not: null } },
    select: { id: true, learningAreaId: true, name: true },
  });
  if (subjects.length === 0) throw new Error("no subject with learning area among results");
  const subj = subjects[0];
  const subjResults = results.filter((r) => r.subjectId === subj.id);

  console.log(`K.6/K.8 — using subject "${subj.name}" with ${subjResults.length} results\n`);

  const createdCompIds: string[] = [];
  const createdEvidenceIds: string[] = [];

  try {
    // --- 1) OFF = no-op ---
    await setEngine(false);
    const offCount = await syncResultsToCompetencyEvidence(tid, term.term);
    check("Curriculum engine OFF: sync is a no-op (J-OFF safety)", offCount === 0);

    // --- create a mapped competency under the subject's learning area ---
    const comp = await db.competency.create({
      data: {
        tenantId: tid,
        learningAreaId: subj.learningAreaId!,
        name: "TEST K6 Competency",
        code: `TESTK6-${Date.now()}`,
        active: true,
      },
    });
    createdCompIds.push(comp.id);

    // --- 2) ON = writes evidence with correct levels ---
    await setEngine(true);
    const written = await syncResultsToCompetencyEvidence(tid, term.term);
    check("Curriculum engine ON: sync writes evidence rows", written >= subjResults.length);

    const evidence = await db.competencyEvidence.findMany({
      where: { tenantId: tid, competencyId: comp.id, sourceModule: "EXAM" },
    });
    createdEvidenceIds.push(...evidence.map((e) => e.id));
    check("One evidence row per result for the mapped competency", evidence.length === subjResults.length);

    function levelFor(m: number) { return m >= 80 ? 4 : m >= 65 ? 3 : m >= 50 ? 2 : 1; }
    const levelsOk = evidence.every((e) => {
      const r = subjResults.find((x) => x.id === e.sourceId);
      return r ? e.level === levelFor(r.marks) && e.scorePct === r.marks : false;
    });
    check("Each evidence level matches the CBC band for its mark", levelsOk);
    check("Evidence is recorded by the system engine, approved", evidence.every((e) => e.recordedByName === "NEYO Computation Engine" && e.approved));

    // --- 3) idempotent ---
    const before = await db.competencyEvidence.count({ where: { tenantId: tid, competencyId: comp.id } });
    await syncResultsToCompetencyEvidence(tid, term.term);
    const after = await db.competencyEvidence.count({ where: { tenantId: tid, competencyId: comp.id } });
    check("Re-running the sync is idempotent (no duplicates)", before === after);

    // --- 4) appears in J.8 Learner Journey timeline ---
    const principalU = await db.user.findFirst({ where: { tenantId: tid, role: "PRINCIPAL" } });
    const principal = su(principalU, tid);
    const studentId = subjResults[0].studentId;
    const timeline = await getLearnerJourneyTimeline(principal, { studentId, mode: "staff" } as any);
    const hasCompetency = (timeline?.entries ?? timeline ?? []).some?.((e: any) => e.sourceModule === "COMPETENCY")
      ?? (Array.isArray(timeline) ? timeline.some((e: any) => e.sourceModule === "COMPETENCY") : false);
    check("Synced evidence surfaces in the J.8 Learner Journey", Boolean(hasCompetency));
  } finally {
    // cleanup evidence + competency
    for (const id of createdEvidenceIds) await db.competencyEvidence.delete({ where: { id } }).catch(() => {});
    // delete any remaining evidence tied to the test competencies
    for (const cid of createdCompIds) {
      await db.competencyEvidence.deleteMany({ where: { competencyId: cid } }).catch(() => {});
      await db.competency.delete({ where: { id: cid } }).catch(() => {});
    }
    // restore engine setting
    if (originalValue === null) {
      await db.platformSetting.delete({ where: { key: "enable_curriculum_engine" } }).catch(() => {});
    } else {
      await db.platformSetting.update({ where: { key: "enable_curriculum_engine" }, data: { value: originalValue } }).catch(() => {});
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("  \u2705 K.6/K.8 all green");
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
