import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { getAdvancedAnalytics } from "@/lib/services/advanced-analytics.service";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
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

  const data = await getAdvancedAnalytics(user);

  assert.ok(Array.isArray(data.attendanceTrend));
  assert.ok(Array.isArray(data.assessmentBalance));
  assert.ok(Array.isArray(data.talentParticipation));
  assert.ok(Array.isArray(data.pathwayReadiness));
  assert.ok(Array.isArray(data.interventions));

  assert.ok(Array.isArray(data.competencyGaps.overall));
  assert.ok(Array.isArray(data.competencyGaps.byClass));
  assert.ok(Array.isArray(data.competencyGaps.byGrade));
  assert.ok(Array.isArray(data.competencyGaps.bySubject));
  assert.ok(Array.isArray(data.competencyGaps.byTeacher));

  assert.ok(data.assessmentBalance.some((x: any) => x.label === "Formal Exams"));
  assert.ok(data.assessmentBalance.some((x: any) => x.label === "Flexible/Projects"));
  assert.ok(data.assessmentBalance.some((x: any) => x.label === "Portfolio Items"));

  assert.ok(typeof data.wellbeingIndicators.participationPct === "number");
  assert.ok(typeof data.wellbeingIndicators.medicalProfiles === "number");
  assert.ok(typeof data.wellbeingIndicators.counselingNotes === "number");
  assert.ok(typeof data.wellbeingIndicators.clinicVisits === "number");

  const routeText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/api/analytics/advanced/route.ts", "utf8"));
  // J.23 tightened this route: it now uses the central error handler (no local fail()).
  assert.ok(routeText.includes('import { ok, handleError }'));
  assert.ok(routeText.includes('requireRevenueFeature'), 'analytics route should be revenue-gated (J.23)');

  const pageText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/(app)/exams/page.tsx", "utf8"));
  assert.ok(pageText.includes('<AdvancedAnalyticsClient />'), "advanced analytics client should be mounted on exams page");

  const uiText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/exams/advanced-analytics-client.tsx", "utf8"));
  assert.ok(uiText.includes("Pathway readiness snapshot"));
  assert.ok(uiText.includes("By teacher"));
  assert.ok(uiText.includes("Talent and wellbeing indicators"));
  assert.ok(!uiText.includes('variant="destructive"'));
  assert.ok(!uiText.includes('<Badge variant='));

  const serviceText = await import("node:fs/promises").then((fs) => fs.readFile("src/lib/services/advanced-analytics.service.ts", "utf8"));
  assert.ok(serviceText.includes('withTenant(user.tenantId'));

  console.log("✅ J.16 advanced analytics full-stack test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
