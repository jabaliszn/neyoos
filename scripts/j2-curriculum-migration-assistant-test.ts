import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import { curriculumBoard, runCurriculumMigrationAssistant } from "../src/lib/services/curriculum.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
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

async function main() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = toSessionUser(principalRow);

  const before = await db.curriculum.count({ where: { tenantId: principal.tenantId } });
  const result = await runCurriculumMigrationAssistant(principal);
  assert(result.mappedSubjects > 0, "migration assistant maps existing subjects");
  assert(result.mappedClasses > 0, "migration assistant maps existing classes");
  assert(result.mappedTerms > 0, "migration assistant maps existing terms");
  assert(result.mappedStrands > 0, "migration assistant maps existing CBC strands where possible");

  const board = await curriculumBoard(principal);
  assert(board.curricula.some((c) => c.name === "8-4-4 Legacy"), "assistant creates/maps 8-4-4 Legacy curriculum");
  assert(board.curricula.some((c) => c.name === "CBC Kenya"), "assistant creates/maps CBC Kenya curriculum");
  assert(board.summary.unmappedSubjects === 0, "all existing subjects are mapped to curriculum + learning area");
  assert(board.summary.unmappedClasses === 0, "all existing classes are mapped to curriculum + grade band");
  assert(board.summary.unmappedTerms === 0, "all existing academic terms are mapped to a curriculum");

  const cbcStrands = await db.cbcStrand.findMany({ where: { tenantId: principal.tenantId } });
  assert(cbcStrands.length === 0 || cbcStrands.every((s) => Boolean(s.learningAreaId)), "all existing CBC strands are mapped to learning areas");

  const afterFirst = await db.curriculum.count({ where: { tenantId: principal.tenantId } });
  await runCurriculumMigrationAssistant(principal);
  const afterSecond = await db.curriculum.count({ where: { tenantId: principal.tenantId } });
  assert(afterSecond === afterFirst && afterFirst >= before, "migration assistant is idempotent and does not duplicate curricula");

  const audit = await db.auditLog.findFirst({ where: { tenantId: principal.tenantId, action: "curriculum.migration_assistant_run" }, orderBy: { createdAt: "desc" } });
  assert(audit, "migration assistant writes an audit log");

  console.log("\nJ.2 Chunk 8 curriculum migration assistant test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
