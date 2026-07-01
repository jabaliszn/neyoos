import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { logCareerRecord, getCareerDiscoveryProfile, getStudentCareerRecords } from "@/lib/services/career-discovery.service";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Atieno" } });

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

  await logCareerRecord(user, {
    studentId: student.id,
    recordType: "STUDENT_INTEREST",
    careerArea: "Engineering & Technology",
    notes: `Interested in robotics, software and aeronautical engineering ${Date.now()}`,
  });
  await logCareerRecord(user, {
    studentId: student.id,
    recordType: "PARENT_CONVERSATION",
    careerArea: "Engineering & Technology",
    notes: "Parent supports a STEM pathway because of strong maths and science performance.",
  });

  const records = await getStudentCareerRecords(user, student.id);
  assert.ok(records.length > 0);

  const profile = await getCareerDiscoveryProfile(user, student.id);
  assert.equal(profile.mode, "RULE_BASED_NO_BUNDI");
  assert.ok(Array.isArray(profile.recommendations));
  assert.ok(profile.recommendations.length > 0, "rule-based recommendations should exist");
  assert.ok(profile.recommendations.some((r: any) => r.area === "Engineering & Technology"), "engineering should be recommended from seeded signals");
  assert.ok(Array.isArray(profile.signals.subjectAverages));
  assert.ok(Array.isArray(profile.signals.competencies));
  assert.ok(Array.isArray(profile.signals.talents));
  assert.ok(Array.isArray(profile.pathwayReadiness));

  const routeText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/api/students/careers/route.ts", "utf8"));
  assert.ok(routeText.includes('requirePermission("student.view")'));
  assert.ok(!routeText.includes('students.view'));
  assert.ok(routeText.includes('view === "profile"'));

  const uiText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/students/student-career-tab.tsx", "utf8"));
  assert.ok(uiText.includes("Rule-based career matches"));
  assert.ok(uiText.includes("Parent/student conversation view"));
  assert.ok(!uiText.includes('variant="outline"'));
  assert.ok(!uiText.includes('<Badge variant='));

  const profileText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/students/student-profile-client.tsx", "utf8"));
  assert.ok(profileText.includes('<StudentCareerTab studentId={s.id} />'));

  const serviceText = await import("node:fs/promises").then((fs) => fs.readFile("src/lib/services/career-discovery.service.ts", "utf8"));
  assert.ok(serviceText.includes('withTenant(user.tenantId'));
  assert.ok(serviceText.includes('RULE_BASED_NO_BUNDI'));

  console.log('✅ J.18 career discovery full-stack test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
