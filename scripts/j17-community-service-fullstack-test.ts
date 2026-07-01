import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { logServiceActivity, decideServiceActivity, getStudentServiceActivities, buildCommunityServiceReport } from "@/lib/services/community-service.service";
import { getLearnerJourneyTimeline } from "@/lib/services/learner-journey.service";
import { renderCommunityServiceReportPdf } from "@/lib/documents/community-service-report-pdf";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Atieno" } });
  const competency = await db.competency.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const storedFile = await db.storedFile.create({
    data: {
      tenantId: tenant.id,
      provider: "local",
      key: `j17-${Date.now()}`,
      fileName: "service-proof.pdf",
      contentType: "application/pdf",
      size: 1234,
      checksumSha256: `j17-${Date.now()}`,
      encrypted: true,
      category: "community-service",
      url: "https://example.com/service-proof.pdf",
      uploadedById: principal.id,
    },
  });

  const user = {
    id: principal.id,
    tenantId: tenant.id,
    neyoLoginId: principal.neyoLoginId,
    fullName: principal.fullName,
    phone: principal.phone,
    email: principal.email,
    role: principal.role,
    secondaryRole: principal.secondaryRole,
    language: principal.language,
  } as any;

  const created = await logServiceActivity(user, {
    studentId: student.id,
    title: `River clean-up ${Date.now()}`,
    category: "COMMUNITY",
    date: "2026-06-29",
    hours: 3,
    location: "Nairobi River",
    supervisorName: "Grace Njeri",
    supervisorPhone: "+254700111222",
    studentReflection: "Learned how service protects the local environment.",
    proofFileId: storedFile.id,
    competencyId: competency.id,
    status: "PENDING",
  });
  assert.equal(created.status, "PENDING");
  assert.equal(created.proofFileId, storedFile.id);

  const approved = await decideServiceActivity(user, { id: created.id, status: "APPROVED", competencyId: competency.id });
  assert.equal(approved.status, "APPROVED");

  const summary = await getStudentServiceActivities(user, student.id);
  assert.ok(summary.activities.some((a: any) => a.id === created.id));
  assert.ok(summary.totalHours >= 3);

  const evidence = await db.competencyEvidence.findFirst({ where: { tenantId: tenant.id, sourceModule: "COMMUNITY", sourceId: created.id } });
  assert.ok(evidence, "community service should contribute to competency evidence");
  assert.equal(evidence?.visibleToParents, true);

  const timeline = await getLearnerJourneyTimeline(user, { studentId: student.id, mode: "staff", limit: 50 });
  assert.ok(timeline.entries.some((e: any) => e.id === `community:${created.id}`), "community service should appear in learner journey timeline");

  const built = await buildCommunityServiceReport(user, student.id);
  const pdf = await renderCommunityServiceReportPdf({
    tenant: { name: built.tenant.name, county: built.tenant.county, addressLine: built.tenant.addressLine, motto: built.tenant.motto, brandPrimary: built.tenant.brandPrimary },
    student: built.summary.student,
    totalHours: built.summary.totalHours,
    activities: built.summary.activities,
    title: "Community Service Report",
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 1000);

  const serviceText = await import("node:fs/promises").then((fs) => fs.readFile("src/lib/services/community-service.service.ts", "utf8"));
  assert.ok(serviceText.includes('withTenant(user.tenantId'));
  const routeText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/api/students/community-service/route.ts", "utf8"));
  assert.ok(routeText.includes('requirePermission("student.view")'));
  assert.ok(routeText.includes('requirePermission("student.edit")'));
  assert.ok(!routeText.includes('students.view'));
  assert.ok(!routeText.includes('students.manage'));
  assert.ok(routeText.includes('format === "pdf"'));
  assert.ok(routeText.includes('format === "certificate"'));

  const uiText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/students/student-service-tab.tsx", "utf8"));
  assert.ok(uiText.includes('Report PDF'));
  assert.ok(uiText.includes('Certificate PDF'));
  assert.ok(!uiText.includes('variant="outline"'));
  assert.ok(!uiText.includes('<Badge variant='));

  const profileText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/students/student-profile-client.tsx", "utf8"));
  assert.ok(profileText.includes('<StudentServiceTab studentId={s.id} />'));

  console.log("✅ J.17 community service full-stack test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
