import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import {
  assessmentBoard,
  AssessmentError,
  attachAssessmentEvidence,
  createAssessmentPlan,
  ensureDefaultAssessmentTypes,
  moderateAssessmentRecord,
  releaseAssessmentPlan,
  scoreAssessmentRecord,
} from "../src/lib/services/assessment.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function expectAssessmentError(code: AssessmentError["code"], fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof AssessmentError && error.code === code, message);
    return;
  }
  throw new Error(`Expected AssessmentError ${code}: ${message}`);
}

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null,
    language: user.language ?? "en",
  };
}

async function cleanup(tenantId: string) {
  await db.assessmentEvidence.deleteMany({ where: { tenantId } });
  await db.assessmentRecord.deleteMany({ where: { tenantId } });
  await db.assessmentPlan.deleteMany({ where: { tenantId, title: { startsWith: "J3 Service" } } });
  await db.assessmentType.deleteMany({ where: { tenantId, key: "J3_ORAL" } });
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const [principalRow, chebetRow, njorogeRow, parentRow, bursarRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "bursar@karibuhigh.ac.ke" } }),
  ]);
  const principal = toSessionUser(principalRow);
  const chebet = toSessionUser(chebetRow);
  const njoroge = toSessionUser(njorogeRow);
  const parent = toSessionUser(parentRow);
  const bursar = toSessionUser(bursarRow);

  await cleanup(tenant.id);
  await ensureDefaultAssessmentTypes(principal);
  const seededTypes = await db.assessmentType.count({ where: { tenantId: tenant.id } });
  assert(seededTypes >= 10, "default assessment type catalog is seeded");

  const oral = await db.assessmentType.findFirstOrThrow({ where: { tenantId: tenant.id, key: "ORAL" } });
  const [cls, subject, term, curriculum, learningArea] = await Promise.all([
    db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 2", stream: "East" } }),
    db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "ENG" } }),
    db.academicTerm.findFirstOrThrow({ where: { tenantId: tenant.id, current: true } }),
    db.curriculum.findFirst({ where: { tenantId: tenant.id, name: "8-4-4 Legacy" } }),
    db.learningArea.findFirst({ where: { tenantId: tenant.id, code: "ENG" } }),
  ]);
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, classId: cls.id, status: "ACTIVE", deletedAt: null } });

  const plan = await createAssessmentPlan(principal, {
    assessmentTypeId: oral.id,
    curriculumId: curriculum?.id,
    learningAreaId: learningArea?.id,
    subjectId: subject.id,
    classId: cls.id,
    academicTermId: term.id,
    year: term.year,
    term: term.term,
    title: "J3 Service Oral Presentation",
    instructions: "Learners explain their project in class.",
    weight: 10,
    maxMarks: 50,
    dueDate: "2026-07-20",
    status: "ACTIVE",
    visibleToParents: false,
  });
  assert(plan.id && plan.classId === cls.id, "principal creates a flexible assessment plan linked to class/subject/term");

  await expectAssessmentError("FORBIDDEN", () => assessmentBoard(bursar), "bursar cannot access assessment board");
  await expectAssessmentError("FORBIDDEN", () => scoreAssessmentRecord(njoroge, {
    planId: plan.id,
    studentId: student.id,
    scoreMarks: 40,
  }), "teacher outside the class cannot score the assessment");

  const scored = await scoreAssessmentRecord(chebet, {
    planId: plan.id,
    studentId: student.id,
    scoreMarks: 42,
    rubricLevel: 4,
    rubricCode: "EE",
    narrative: "Achieng spoke clearly and used examples from the model.",
    sourceModule: "MANUAL",
    sourceId: plan.id,
  });
  assert(scored.scorePct === 84 && scored.rubricCode === "EE", "class teacher scores marks/rubric/narrative and scorePct is computed");

  const evidence = await attachAssessmentEvidence(chebet, {
    recordId: scored.id,
    evidenceType: "NOTE",
    note: "Presentation checklist observed in class.",
  });
  assert(evidence.recordId === scored.id, "teacher attaches assessment evidence note");

  const moderated = await moderateAssessmentRecord(principal, { recordId: scored.id, status: "MODERATED", note: "Checked by academics office." });
  assert(moderated.status === "MODERATED" && moderated.moderatedById === principal.id, "principal moderates assessment record");

  const beforeReleaseParentBoard = await assessmentBoard(parent);
  assert(beforeReleaseParentBoard.plans.length === 0, "parent cannot see unreleased flexible assessment plan");

  const released = await releaseAssessmentPlan(principal, { planId: plan.id, visibleToParents: true, note: "Release oral assessment." });
  assert(released.status === "RELEASED" && released.visibleToParents, "principal releases assessment plan to parents");

  const releasedRecord = await db.assessmentRecord.findUniqueOrThrow({ where: { id: scored.id } });
  assert(releasedRecord.status === "RELEASED" && Boolean(releasedRecord.releasedAt), "release updates scored records to RELEASED");

  const parentBoard = await assessmentBoard(parent);
  assert(parentBoard.plans.some((p) => p.id === plan.id), "parent sees released assessment for own child");

  const audits = await db.auditLog.findMany({ where: { tenantId: tenant.id, action: { in: ["assessment.plan_created", "assessment.record_scored", "assessment.evidence_attached", "assessment.record_moderated", "assessment.plan_released"] } } });
  assert(audits.length >= 5, "assessment service writes audit logs for main actions");

  await cleanup(tenant.id);
  console.log("\nJ.3 Chunk 3 assessment service test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
