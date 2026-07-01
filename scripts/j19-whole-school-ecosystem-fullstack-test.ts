import assert from 'node:assert/strict';
import fs from 'node:fs';
import { db } from '../src/lib/db';
import { getAnonymousEducationTrends } from '../src/lib/services/ecosystem-trends.service';
import { getLearnerJourneyTimeline } from '../src/lib/services/learner-journey.service';
import { getParentGrowthDashboard } from '../src/lib/services/parent-growth.service';

async function main() {
  const principal = await db.user.findFirstOrThrow({ where: { email: 'principal@karibuhigh.ac.ke' } });
  const founder = await db.user.findFirstOrThrow({ where: { email: 'support@neyo.co.ke' } });
  const parent = await db.user.findFirstOrThrow({ where: { role: 'PARENT' } });
  const studentUser = await db.user.findFirstOrThrow({ where: { email: 'achieng@karibuhigh.ac.ke' } });
  const student = await db.student.findFirstOrThrow({ where: { userId: studentUser.id } });

  const principalUser = { id: principal.id, tenantId: principal.tenantId, neyoLoginId: principal.neyoLoginId, fullName: principal.fullName, phone: principal.phone, email: principal.email, role: principal.role as any, secondaryRole: principal.secondaryRole as any, language: principal.language as any };
  const founderUser = { id: founder.id, tenantId: founder.tenantId, neyoLoginId: founder.neyoLoginId, fullName: founder.fullName, phone: founder.phone, email: founder.email, role: founder.role as any, secondaryRole: founder.secondaryRole as any, language: founder.language as any };
  const parentUser = { id: parent.id, tenantId: parent.tenantId, neyoLoginId: parent.neyoLoginId, fullName: parent.fullName, phone: parent.phone, email: parent.email, role: parent.role as any, secondaryRole: parent.secondaryRole as any, language: parent.language as any };

  const journey = await getLearnerJourneyTimeline(principalUser, { studentId: student.id, mode: 'staff', limit: 200 });
  assert(journey.entries.length > 0, 'learner journey should load');
  const sources = new Set(journey.entries.map((x) => x.sourceModule));
  assert(sources.has('ATTENDANCE'), 'journey should include attendance');
  assert(sources.has('DISCIPLINE'), 'journey should include discipline');
  assert(sources.has('ASSESSMENT') || sources.has('EXAM'), 'journey should include assessments/exams');
  assert(sources.has('COMPETENCY'), 'journey should include competencies');
  assert(sources.has('PORTFOLIO'), 'journey should include portfolio');
  assert(sources.has('SKILLS'), 'journey should include clubs/talent via skills passport');

  const growth = await getParentGrowthDashboard(parentUser, student.id);
  assert(typeof growth.summary.attendancePct === 'number', 'parent growth should include attendance');
  assert(Array.isArray(growth.talents), 'parent growth should include talents');
  assert(Array.isArray(growth.competencies), 'parent growth should include competencies');
  assert(Array.isArray(growth.portfolio), 'parent growth should include portfolio');
  assert(Array.isArray(growth.feedbackDigest), 'parent growth should include teacher feedback digest');

  const trends = await getAnonymousEducationTrends(founderUser);
  assert.equal(trends.privacy.mode, 'ANONYMOUS_AGGREGATE_ONLY');
  assert.equal(trends.privacy.returnsSchoolNames, false);
  assert.equal(trends.privacy.returnsLearnerNames, false);
  const trendJson = JSON.stringify(trends);
  assert(!trendJson.includes('Karibu High'), 'cross-tenant trends must not expose school names');
  assert(!trendJson.includes('Achieng'), 'cross-tenant trends must not expose learner names');

  const portfolioService = fs.readFileSync('src/lib/services/portfolio.service.ts', 'utf8');
  assert(portfolioService.includes('Portfolio files must use the encrypted Storage Vault path.'), 'portfolio evidence must enforce encrypted storage vault');

  const founderTab = fs.readFileSync('src/components/founder/ecosystem-trends-tab.tsx', 'utf8');
  assert(founderTab.includes('/api/ops/education-trends'), 'founder trends tab should be mounted to real API');

  const route = fs.readFileSync('src/app/api/ops/education-trends/route.ts', 'utf8');
  assert(route.includes('platform.founder_ops'), 'ops trends route should use correct founder permission');

  console.log('PASS J19 ecosystem integration fullstack');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
