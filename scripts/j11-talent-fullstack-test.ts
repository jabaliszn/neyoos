import fs from "fs";
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  recordStudentTalent,
  deleteTalentRecord,
  getTalentParticipationAnalytics,
  buildTalentReport,
  TalentError,
} from "../src/lib/services/talent.service";
import { renderTalentReportPdf } from "../src/lib/documents/talent-report";

const db = new PrismaClient();

async function main() {
  // ---- static wiring ----
  assert(fs.existsSync("src/app/api/talents/analytics/route.ts"), "analytics route must exist");
  assert(fs.existsSync("src/app/api/talents/report/route.ts"), "report route must exist");
  const tabSrc = fs.readFileSync("src/components/students/student-talent-tab.tsx", "utf8");
  assert(tabSrc.includes("portfolioItemId") && tabSrc.includes("/api/portfolio?studentId="), "talent tab must offer a portfolio evidence picker");
  const mgrSrc = fs.readFileSync("src/components/academics/talent-manager.tsx", "utf8");
  assert(mgrSrc.includes("/api/talents/analytics") && mgrSrc.includes("Talent report"), "talent manager must show analytics + report button");
  const svc = fs.readFileSync("src/lib/services/talent.service.ts", "utf8");
  assert(svc.includes("skillsPassportEntry.create"), "recordStudentTalent must mirror into Skills Passport");
  // analytics bug fix confirmed
  const aa = fs.readFileSync("src/lib/services/advanced-analytics.service.ts", "utf8");
  assert(!aa.includes("isApproved"), "advanced-analytics must not query non-existent isApproved field");
  assert(!aa.includes("\\`"), "advanced-analytics must not contain escaped backticks");

  const principal = await db.user.findFirst({ where: { email: "principal@karibuhigh.ac.ke" } });
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  if (!principal || !tenant) throw new Error("Expected seeded principal + karibu-high tenant.");

  const user = {
    id: principal.id, tenantId: principal.tenantId, neyoLoginId: "test",
    fullName: principal.fullName, phone: null, email: principal.email,
    role: principal.role as any, secondaryRole: principal.secondaryRole as any, language: "en",
  };

  await withTenant(tenant.id, async () => {
    const student = await tenantDb().student.findFirst({ orderBy: { admissionNo: "asc" } });
    if (!student) throw new Error("need a seeded student");

    const area = await tenantDb().talentArea.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Test Football" } },
      update: {},
      create: { tenantId: tenant.id, name: "Test Football", category: "SPORTS", description: "test" },
    });

    // baseline skills passport count for this student
    const before = await tenantDb().skillsPassportEntry.count({ where: { studentId: student.id } });

    // ---- 1) record a talent -> mirrors into Skills Passport ----
    const rec = await recordStudentTalent(user, { studentId: student.id, talentAreaId: area.id, score: 88, notes: "Great striker" });
    const after = await tenantDb().skillsPassportEntry.count({ where: { studentId: student.id } });
    assert(after === before + 1, "talent record must create a Skills Passport entry");
    const mirrored = await tenantDb().skillsPassportEntry.findFirst({ where: { studentId: student.id, sourceId: rec.id } });
    assert(mirrored, "mirrored Skills Passport entry must be linked by sourceId");
    assert(mirrored!.ratingLevel === 5, "score 88 should map to 5-star rating");

    // ---- 2) reject portfolio item from another student ----
    const otherItem = await tenantDb().portfolioItem.findFirst({ where: { studentId: { not: student.id } } });
    if (otherItem) {
      let rejected = false;
      try {
        await recordStudentTalent(user, { studentId: student.id, talentAreaId: area.id, portfolioItemId: otherItem.id });
      } catch (e) { rejected = e instanceof TalentError; }
      assert(rejected, "linking another student's portfolio item must be rejected");
    }

    // ---- 3) analytics broken down by class/grade/gender/term ----
    const an = await getTalentParticipationAnalytics(user);
    assert(an.totals.records >= 1, "analytics totals must count records");
    assert(Array.isArray(an.byClass) && Array.isArray(an.byGrade) && Array.isArray(an.byGender) && Array.isArray(an.byTerm), "analytics must break down by class/grade/gender/term");
    assert(an.byGender.length >= 1, "analytics must have gender breakdown");

    // ---- 4) report + PDF ----
    const report = await buildTalentReport(user, {});
    const pdf = await renderTalentReportPdf({
      schoolName: tenant.name, generatedDate: "Today", termLabel: report.termLabel, analytics: report.analytics,
    });
    assert(pdf.subarray(0, 4).toString() === "%PDF", "talent report PDF must be valid");

    // ---- 5) delete cleans up the mirrored passport entry ----
    await deleteTalentRecord(user, rec.id);
    const cleaned = await tenantDb().skillsPassportEntry.count({ where: { studentId: student.id, sourceId: rec.id } });
    assert(cleaned === 0, "deleting a talent record must remove its mirrored Skills Passport entry");

    // cleanup test area
    await tenantDb().talentArea.delete({ where: { id: area.id } }).catch(() => {});

    console.log("✓ J.11 full-stack test passed: Skills Passport link + portfolio guard + analytics + report PDF + cleanup.");
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
