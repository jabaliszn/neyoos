import fs from "fs";
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  setStudentPreferences,
  allocateStudentToPathway,
  getStudentPathwayReadiness,
  buildPathwayReport,
  PathwayError,
} from "../src/lib/services/pathway.service";
import { parentChildPathwayReadiness } from "../src/lib/services/parent-portal.service";
import { renderPathwayReportPdf } from "../src/lib/documents/pathway-report";

const db = new PrismaClient();

async function main() {
  // ---- Static wiring checks (files exist + routes wired) ----
  assert(fs.existsSync("src/app/api/pathways/readiness/route.ts"), "readiness route must exist");
  assert(fs.existsSync("src/app/api/pathways/report/route.ts"), "report route must exist");
  assert(fs.existsSync("src/app/api/portal/parent/pathway/route.ts"), "parent pathway route must exist");
  const prefRoute = fs.readFileSync("src/app/api/pathways/preferences/route.ts", "utf8");
  assert(prefRoute.includes("export async function POST"), "preferences route must expose POST to set preferences");
  assert(prefRoute.includes("setStudentPreferences"), "preferences POST must call setStudentPreferences");
  const svc = fs.readFileSync("src/lib/services/pathway.service.ts", "utf8");
  assert(svc.includes("is full"), "allocate must enforce capacity with a friendly full message");
  assert(svc.includes("pathway.allocated") && svc.includes("pathway.report_generated"), "service must audit allocation + report");

  const principal = await db.user.findFirst({ where: { email: "principal@karibuhigh.ac.ke" } });
  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  if (!principal || !tenant) throw new Error("Expected seeded principal + karibu-high tenant.");

  const user = {
    id: principal.id,
    tenantId: principal.tenantId,
    neyoLoginId: "test",
    fullName: principal.fullName,
    phone: null,
    email: principal.email,
    role: principal.role as any,
    secondaryRole: principal.secondaryRole as any,
    language: "en",
  };

  await withTenant(tenant.id, async () => {
    const students = await tenantDb().student.findMany({ take: 3, orderBy: { admissionNo: "asc" } });
    assert(students.length >= 1, "need at least one seeded student");
    const student = students[0];

    // ---- Ensure two pathways exist; one tiny capacity for the capacity test ----
    const mat = await tenantDb().subject.findFirst({ where: { code: "MAT" } });
    const stem = await tenantDb().pathway.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "STEM" } },
      update: { capacity: 40 },
      create: { tenantId: tenant.id, name: "STEM", code: "STEM", capacity: 40 },
    });
    // Tiny pathway to prove capacity enforcement.
    const tiny = await tenantDb().pathway.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "TINY" } },
      update: { capacity: 1 },
      create: { tenantId: tenant.id, name: "Tiny Pathway", code: "TINY", capacity: 1 },
    });

    // Attach a requirement with a minScore to STEM so readiness can be computed.
    if (mat) {
      await tenantDb().pathwaySubjectRequirement.upsert({
        where: { tenantId_pathwayId_subjectId: { tenantId: tenant.id, pathwayId: stem.id, subjectId: mat.id } },
        update: { minScorePct: 70, isCore: true },
        create: { tenantId: tenant.id, pathwayId: stem.id, subjectId: mat.id, isCore: true, minScorePct: 70 },
      });
    }

    // ---- 1) set preferences (the previously-missing screen's backend) ----
    const prefs = await setStudentPreferences(user, student.id, [
      { pathwayId: stem.id, choiceOrder: 1 },
      { pathwayId: tiny.id, choiceOrder: 2 },
    ]);
    assert(prefs.length >= 2, "setStudentPreferences must persist ranked choices");

    // duplicate-order rejection
    let rejected = false;
    try {
      await setStudentPreferences(user, student.id, [
        { pathwayId: stem.id, choiceOrder: 1 },
        { pathwayId: tiny.id, choiceOrder: 1 },
      ]);
    } catch (e) {
      rejected = e instanceof PathwayError;
    }
    assert(rejected, "duplicate choice orders must be rejected");
    // restore valid prefs
    await setStudentPreferences(user, student.id, [
      { pathwayId: stem.id, choiceOrder: 1 },
      { pathwayId: tiny.id, choiceOrder: 2 },
    ]);

    // ---- 2) capacity enforcement ----
    // Fill the tiny (cap 1) pathway with student[0]
    await allocateStudentToPathway(user, student.id, { pathwayId: tiny.id, isAllocated: true, isRecommended: false, teacherNotes: null });
    // A SECOND student into the same tiny pathway must be blocked.
    if (students[1]) {
      let capBlocked = false;
      try {
        await allocateStudentToPathway(user, students[1].id, { pathwayId: tiny.id, isAllocated: true, isRecommended: false, teacherNotes: null });
      } catch (e) {
        capBlocked = e instanceof PathwayError && (e as PathwayError).code === "CONFLICT";
      }
      assert(capBlocked, "allocation beyond capacity must be blocked with CONFLICT");
    }
    // Re-allocating the SAME already-seated student must NOT be blocked by capacity.
    await allocateStudentToPathway(user, student.id, { pathwayId: tiny.id, isAllocated: true, isRecommended: true, teacherNotes: "ok" });

    // ---- 3) readiness engine ----
    const readiness = await getStudentPathwayReadiness(user, student.id);
    assert(readiness.student.id === student.id, "readiness returns the right student");
    const stemReadiness = readiness.pathways.find((p) => p.pathwayCode === "STEM");
    assert(stemReadiness, "STEM readiness present");
    assert(stemReadiness!.requirementsTotal >= (mat ? 1 : 0), "STEM should reflect its requirements");
    assert(["READY", "ALMOST", "DEVELOPING", "NO_DATA"].includes(stemReadiness!.overallReadiness), "valid readiness label");
    assert(typeof stemReadiness!.academicReadinessPct === "number", "academic readiness pct computed");

    // ---- 4) parent-safe readiness (no teacher private notes leaked) ----
    const parentView = await parentChildPathwayReadiness(user, student.id);
    assert(Array.isArray(parentView.pathways), "parent readiness returns pathways");
    const parentJson = JSON.stringify(parentView);
    assert(!parentJson.includes("teacherNotes"), "parent view must not expose raw teacherNotes field");

    // ---- 5) report + PDF ----
    const report = await buildPathwayReport(user);
    assert(report.rows.length >= 2, "report includes pathways");
    assert(typeof report.totals.allocated === "number", "report totals computed");
    const pdf = await renderPathwayReportPdf({
      schoolName: tenant.name,
      generatedDate: "Today",
      totals: report.totals,
      rows: report.rows,
    });
    assert(pdf.subarray(0, 4).toString() === "%PDF", "report PDF must be a valid PDF buffer");

    console.log("✓ J.10 full-stack test passed: preferences + capacity + readiness + parent view + report PDF.");
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
