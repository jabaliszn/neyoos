import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import {
  approveCompetencyEvidence,
  competencyBoard,
  competencyHeatmap,
  CompetencyError,
  createCompetency,
  createCompetencyGroup,
  ensureDefaultCompetencyFramework,
  recordCompetencyEvidence,
  studentCompetencySummary,
} from "../src/lib/services/competency.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function expectCompetencyError(code: CompetencyError["code"], fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (error) {
    assert(error instanceof CompetencyError && error.code === code, message);
    return;
  }
  throw new Error(`Expected CompetencyError ${code}: ${message}`);
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
  await db.competencyEvidence.deleteMany({ where: { tenantId, sourceModule: "MANUAL" } });
  await db.competency.deleteMany({ where: { tenantId, code: { startsWith: "J4S_" } } });
  await db.competencyGroup.deleteMany({ where: { tenantId, code: { startsWith: "J4S_" } } });
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const [principalRow, chebetRow, njorogeRow, parentRow, accountantRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } }),
  ]);
  const principal = toSessionUser(principalRow);
  const chebet = toSessionUser(chebetRow);
  const njoroge = toSessionUser(njorogeRow);
  const parent = toSessionUser(parentRow);
  const accountant = toSessionUser(accountantRow);

  await cleanup(tenant.id);
  const seeded = await ensureDefaultCompetencyFramework(principal);
  assert(seeded.competenciesCreated + seeded.competenciesUpdated >= 7, "default competency framework is seeded");

  const group = await createCompetencyGroup(principal, { name: "J4S Leadership", code: "j4s_leadership", description: "Leadership growth", sequence: 9 });
  assert(group.code === "J4S_LEADERSHIP", "principal creates competency group with normalized code");

  const competency = await createCompetency(principal, { groupId: group.id, name: "J4S Public Speaking", code: "j4s_public_speaking", description: "Speaks clearly in front of others", sequence: 1 });
  assert(competency.groupId === group.id, "principal creates competency linked to group");

  await expectCompetencyError("DUPLICATE", () => createCompetency(principal, { name: "Duplicate", code: "j4s_public_speaking" }), "duplicate competency code is blocked");

  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 2", stream: "East" } });
  const ownStudent = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, classId: f2e.id, status: "ACTIVE", deletedAt: null } });
  const otherClassStudent = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, classId: { not: f2e.id }, status: "ACTIVE", deletedAt: null } });

  await expectCompetencyError("FORBIDDEN", () => recordCompetencyEvidence(njoroge, {
    competencyId: competency.id,
    studentId: ownStudent.id,
    sourceModule: "MANUAL",
    level: 3,
    narrative: "Njoroge should not record outside assigned classes.",
    evidenceDate: "2026-07-01",
  }), "teacher outside class cannot record competency evidence");

  await expectCompetencyError("FORBIDDEN", () => recordCompetencyEvidence(chebet, {
    competencyId: competency.id,
    studentId: otherClassStudent.id,
    sourceModule: "MANUAL",
    level: 3,
    narrative: "Chebet cannot record outside own class.",
    evidenceDate: "2026-07-01",
  }), "class teacher cannot record evidence for another class");

  const evidence = await recordCompetencyEvidence(chebet, {
    competencyId: competency.id,
    studentId: ownStudent.id,
    sourceModule: "MANUAL",
    level: 4,
    scorePct: 86,
    narrative: "Achieng spoke confidently during the oral presentation.",
    evidenceDate: "2026-07-01",
  });
  assert(evidence.id && evidence.recordedById === chebet.id, "class teacher records competency evidence for own class");

  const hiddenParentSummary = await studentCompetencySummary(parent, ownStudent.id);
  assert(hiddenParentSummary.totalEvidence === 0, "parent cannot see unapproved competency evidence");

  await approveCompetencyEvidence(principal, { evidenceId: evidence.id, approved: true, visibleToParents: true, note: "Approved for parent view" });
  const parentSummary = await studentCompetencySummary(parent, ownStudent.id);
  assert(parentSummary.totalEvidence === 1, "parent sees approved visible competency evidence for own child");

  const staffSummary = await studentCompetencySummary(principal, ownStudent.id);
  assert(staffSummary.competencies.some((c) => c.code === "J4S_PUBLIC_SPEAKING"), "staff summary includes recorded competency");

  const heatmap = await competencyHeatmap(principal, { classId: f2e.id });
  assert(heatmap.some((h) => h.code === "J4S_PUBLIC_SPEAKING" && h.averageLevel === 4), "heatmap includes competency average for class");

  await expectCompetencyError("FORBIDDEN", () => competencyBoard(accountant), "accountant cannot access competency board");
  const board = await competencyBoard(principal);
  assert(board.summary.competencies >= 7 && board.summary.evidence >= 1, "competency board returns summary counts");

  const audits = await db.auditLog.findMany({ where: { tenantId: tenant.id, action: { in: ["competency.defaults_seeded", "competency.group_created", "competency.created", "competency.evidence_recorded", "competency.evidence_approved"] } } });
  assert(audits.length >= 5, "competency service writes audit logs");

  await cleanup(tenant.id);
  console.log("\nJ.4 Chunk 3 competency service test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
