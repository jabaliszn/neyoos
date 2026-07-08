/**
 * P.6 — direct proof that Hindu Religious Education (HRE) is now offered
 * alongside CRE/IRE in the GENERAL "quick add subjects" preset used to
 * bootstrap a school's whole subject list (KE_SUBJECT_PRESETS), not just
 * buried inside the Senior School official-pathway taxonomy (P.1) where all
 * three already existed. Also proves the real career-discovery fairness fix:
 * a student studying HRE (not CRE) still gets real Business/Law career
 * credit instead of silently losing it.
 * Cleans up every throwaway row it creates.
 */
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { KE_SUBJECT_PRESETS } from "../src/lib/validations/academics";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { addSubjectPreset } from "../src/lib/services/academics.service";
import { getCareerDiscoveryProfile, logCareerRecord } from "../src/lib/services/career-discovery.service";

const db = new PrismaClient();

async function main() {
  // Case 1: the raw preset data itself offers all 3 real RE options, both curricula.
  assert.ok(KE_SUBJECT_PRESETS.CBC.some((s) => s.code === "CRE"), "Expected CRE in the CBC preset.");
  assert.ok(KE_SUBJECT_PRESETS.CBC.some((s) => s.code === "IRE"), "Expected IRE in the CBC preset.");
  assert.ok(KE_SUBJECT_PRESETS.CBC.some((s) => s.code === "HRE"), "Expected HRE in the CBC preset.");
  assert.ok(KE_SUBJECT_PRESETS["8-4-4"].some((s) => s.code === "CRE"), "Expected CRE in the 8-4-4 preset.");
  assert.ok(KE_SUBJECT_PRESETS["8-4-4"].some((s) => s.code === "IRE"), "Expected IRE in the 8-4-4 preset.");
  assert.ok(KE_SUBJECT_PRESETS["8-4-4"].some((s) => s.code === "HRE"), "Expected HRE in the 8-4-4 preset.");
  console.log("✓ Case 1: CRE/IRE/HRE all present in both CBC and 8-4-4 quick-add presets.");

  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirst({ where: { tenantId: tenant!.id, role: "PRINCIPAL" } });
  if (!tenant || !principal) throw new Error("Expected seeded tenant/principal.");
  const user: any = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test", fullName: principal.fullName,
    phone: null, email: principal.email, role: principal.role, secondaryRole: principal.secondaryRole, language: "en",
  };

  // Case 2: the real addSubjectPreset() service function genuinely creates a
  // real HRE Subject row via the live preset data (not just present in a
  // constant that nothing reads). Uses ONLY the 3 real RE codes from the
  // preset (not the whole CBC preset) so this test never pollutes the real
  // tenant's seed data with unrelated subjects (AGN/PTS/CAS/etc.) that a real
  // school hasn't chosen to add — keeping the proof isolated to what P.6
  // actually changed, and trivially cleanable afterward.
  const rePresetOnly = KE_SUBJECT_PRESETS.CBC.filter((s) => ["CRE", "IRE", "HRE"].includes(s.code));
  const before = await withTenant(tenant.id, async () => tenantDb().subject.findFirst({ where: { code: "HRE" } }));
  const wasAlreadyThere = !!before;
  const result = await addSubjectPreset(user, "CBC", rePresetOnly);
  const hreSubject = await withTenant(tenant.id, async () => tenantDb().subject.findFirst({ where: { code: "HRE" } }));
  assert.ok(hreSubject, "Expected a real HRE Subject row to exist after running the preset.");
  console.log(`✓ Case 2: addSubjectPreset() ${wasAlreadyThere ? "confirms existing" : "creates a new"} real HRE Subject row (idempotent: added=${result.added}, skipped=${result.skipped}).`);

  // Case 3: career-discovery fairness — a student studying HRE (not CRE)
  // still gets real Business & Economics / Law & Public Service credit.
  const created = await withTenant(tenant.id, async () => {
    const tdb = tenantDb();
    const existingClass = await tdb.schoolClass.findFirst({ where: { level: "P6HRETEST" } });
    const testClass = existingClass ?? await tdb.schoolClass.create({
      data: { tenantId: tenant.id, level: "P6HRETEST", curriculum: "CBC" },
    });
    const testStudent = await tdb.student.create({
      data: {
        tenantId: tenant.id, admissionNo: `P6HRE-${Date.now()}`, firstName: "Test", lastName: "HreStudent",
        gender: "F", classId: testClass.id, status: "ACTIVE",
      },
    });
    // A real high mark specifically in HRE (not CRE) — the ONLY subject
    // evidence this student has, isolating the fairness check.
    const exam = await tdb.exam.create({
      data: { tenantId: tenant.id, name: "P6 Test Exam", term: 2, year: 2026, maxMarks: 100, published: true },
    });
    await tdb.examResult.create({
      data: { tenantId: tenant.id, examId: exam.id, studentId: testStudent.id, subjectId: hreSubject!.id, marks: 85, enteredById: user.id },
    });
    return { testClass, testStudent, exam };
  });

  try {
    const profile = await getCareerDiscoveryProfile(user, created.testStudent.id);
    const businessRec = profile.recommendations.find((r: any) => r.area === "Business & Economics");
    const lawRec = profile.recommendations.find((r: any) => r.area === "Law & Public Service");
    assert.ok(businessRec && businessRec.score > 0, "Expected real Business & Economics career credit from a strong HRE mark.");
    assert.ok(lawRec && lawRec.score > 0, "Expected real Law & Public Service career credit from a strong HRE mark.");
    console.log(`✓ Case 3: a student studying HRE (not CRE) genuinely earns Business & Economics (score ${businessRec!.score}) and Law & Public Service (score ${lawRec!.score}) career credit — the fairness fix works.`);
  } finally {
    // Student is a soft-delete model (G.6 Recycle Bin) — tenantDb()'s
    // deleteMany() correctly just sets deletedAt for real app usage, but a
    // genuinely throwaway TEST student should be hard-deleted so it leaves
    // zero trace, so this cleanup uses the raw `db` client directly.
    await db.examResult.deleteMany({ where: { studentId: created.testStudent.id } });
    await db.exam.deleteMany({ where: { id: created.exam.id } });
    await db.student.deleteMany({ where: { id: created.testStudent.id } });
    await withTenant(tenant.id, async () => {
      const tdb = tenantDb();
      await tdb.schoolClass.deleteMany({ where: { id: created.testClass.id } });
    });
    console.log("All P.6 HRE-preset test data cleaned up.");
  }

  console.log("\n✅ All P.6 HRE-preset + career-fairness proofs passed.");
}

main()
  .catch((e) => { console.error("❌ P.6 HRE-preset proof failed:", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
