/**
 * P.4 — direct proof that a real KJSEA score genuinely changes the pathway
 * readiness VERDICT (not just that the number is displayed alongside it).
 * Creates a throwaway pathway with one subject requirement whose average
 * lands the pathway in "ALMOST", then shows a real KJSEA>=70 promotes it to
 * READY, and separately shows a real KJSEA<50 demotes a READY-by-internal-
 * data-alone pathway down to ALMOST. Cleans up everything it creates.
 */
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { getStudentPathwayReadiness, recordNationalAssessment } from "../src/lib/services/pathway.service";

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirst({ where: { tenantId: tenant!.id, role: "PRINCIPAL" } });
  const student = await db.student.findFirst({ where: { tenantId: tenant!.id, admissionNo: "KHS2" } }); // use a DIFFERENT student than the seeded KJSEA one
  if (!tenant || !principal || !student) throw new Error("Expected seeded tenant/principal/student.");

  const user: any = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test", fullName: principal.fullName,
    phone: null, email: principal.email, role: principal.role, secondaryRole: principal.secondaryRole, language: "en",
  };

  const created = await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    // Two subjects the test student has real exam averages for (~62% and
    // ~55% per B.5 seed data): one threshold set LOW (met) and one set HIGH
    // (unmet) so academicReadinessPct lands at exactly 50% -> the real
    // ALMOST band (50-99%), not DEVELOPING (0-49%) or READY (100%).
    const mat = await tdb.subject.findFirst({ where: { code: "MAT" } }); // ~62% avg
    const eng = await tdb.subject.findFirst({ where: { code: "ENG" } }); // ~55% avg
    const testPathway = await tdb.pathway.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "P4TEST" } },
      update: { capacity: null },
      create: { tenantId: tenant.id, name: "P4 Test Pathway", code: "P4TEST" },
    });
    await tdb.pathwaySubjectRequirement.deleteMany({ where: { pathwayId: testPathway.id } });
    await tdb.pathwaySubjectRequirement.createMany({
      data: [
        { tenantId: tenant.id, pathwayId: testPathway.id, subjectId: mat!.id, isCore: true, minScorePct: 50 }, // ~62% -> MET
        { tenantId: tenant.id, pathwayId: testPathway.id, subjectId: eng!.id, isCore: true, minScorePct: 90 }, // ~55% -> UNMET
      ],
    });
    return testPathway.id;
  });

  // --- Case 1: KJSEA >= 70 promotes ALMOST -> READY (when academicReadinessPct >= 50) ---
  await recordNationalAssessment(user, {
    studentId: student.id, milestone: "KJSEA", year: 2025, indexNo: "TEST-1", overallScorePct: 75,
    overallGrade: null, subjects: [], status: "CONFIRMED", notes: "P.4 test — promotion case",
  });
  const readiness1 = await getStudentPathwayReadiness(user, student.id);
  const testRow1 = readiness1.pathways.find((p) => p.pathwayCode === "P4TEST")!;
  console.log("Case 1 (KJSEA=75):", JSON.stringify({ overallReadiness: testRow1.overallReadiness, academicReadinessPct: testRow1.academicReadinessPct, kjseaInfluencedReadiness: testRow1.kjseaInfluencedReadiness }));

  // --- Case 2: KJSEA < 50 demotes READY -> ALMOST ---
  // Lower the bar so academic data alone says READY (100% requirements met).
  await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    await tdb.pathwaySubjectRequirement.updateMany({ where: { pathwayId: created }, data: { minScorePct: 10 } }); // trivially met -> READY by internal data alone
  });
  await recordNationalAssessment(user, {
    studentId: student.id, milestone: "KJSEA", year: 2025, indexNo: "TEST-2", overallScorePct: 35,
    overallGrade: null, subjects: [], status: "CONFIRMED", notes: "P.4 test — demotion case",
  });
  const readiness2 = await getStudentPathwayReadiness(user, student.id);
  const testRow2 = readiness2.pathways.find((p) => p.pathwayCode === "P4TEST")!;
  console.log("Case 2 (KJSEA=35):", JSON.stringify({ overallReadiness: testRow2.overallReadiness, academicReadinessPct: testRow2.academicReadinessPct, kjseaInfluencedReadiness: testRow2.kjseaInfluencedReadiness }));

  assert.strictEqual(testRow1.overallReadiness, "READY", "Case 1: expected KJSEA=75 to promote ALMOST->READY");
  assert.strictEqual(testRow1.kjseaInfluencedReadiness, true, "Case 1: expected kjseaInfluencedReadiness=true");
  assert.strictEqual(testRow2.overallReadiness, "ALMOST", "Case 2: expected KJSEA=35 to demote READY->ALMOST");
  assert.strictEqual(testRow2.kjseaInfluencedReadiness, true, "Case 2: expected kjseaInfluencedReadiness=true");

  // Cleanup
  await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    await tdb.pathwaySubjectRequirement.deleteMany({ where: { pathwayId: created } });
    await tdb.pathway.delete({ where: { id: created } });
  });
  await db.studentNationalAssessment.deleteMany({ where: { studentId: student.id, milestone: "KJSEA", indexNo: { in: ["TEST-1", "TEST-2"] } } });

  console.log("✅ P.4 KJSEA influence proven: a real confirmed KJSEA score genuinely PROMOTES and DEMOTES the pathway readiness verdict, not just displayed alongside it.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
