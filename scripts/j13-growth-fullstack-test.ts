import fs from "fs";
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  getParentGrowthDashboard,
  acknowledgeStudentGoal,
  isGoalAckEnabled,
  GrowthError,
} from "../src/lib/services/parent-growth.service";

const db = new PrismaClient();

async function main() {
  // ---- static wiring ----
  assert(fs.existsSync("src/app/api/portal/parent/growth/route.ts"), "growth route must exist");
  const client = fs.readFileSync("src/components/portal/parent-portal-client.tsx", "utf8");
  assert(client.includes("<ParentGrowthTab"), "ParentGrowthTab MUST be mounted (not just imported) in the parent portal");
  const tab = fs.readFileSync("src/components/portal/parent-growth-tab.tsx", "utf8");
  assert(!tab.includes('variant="outline"'), "tab must not use invalid variant=outline (not a real Button/Badge variant)");
  assert(!/<Badge[^>]*variant=/.test(tab), "Badge must use tone, never variant");
  assert(tab.includes("Attendance") && tab.includes("Behavior") && tab.includes("Portfolio highlights") && tab.includes("Teacher feedback digest"), "tab must render attendance + behavior + portfolio + feedback digest");
  const svc = fs.readFileSync("src/lib/services/parent-growth.service.ts", "utf8");
  assert(!svc.includes('status: "PUBLISHED"'), "service must not query the non-existent PUBLISHED status");
  assert(svc.includes("withTenant"), "service must run inside withTenant");
  assert(svc.includes("approved: true") && svc.includes("visibleToParents: true"), "competency/portfolio must be approved + parent-visible only");

  const tenant = await db.tenant.findFirst({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Expected seeded karibu-high tenant.");

  // Achieng + her guardian parent user
  const achiengUser = await db.user.findFirst({ where: { tenantId: tenant.id, email: "achieng@karibuhigh.ac.ke" } });
  const achieng = achiengUser
    ? await db.student.findFirst({ where: { tenantId: tenant.id, userId: achiengUser.id }, include: { guardians: { include: { guardian: true } } } })
    : await db.student.findFirst({ where: { tenantId: tenant.id, firstName: "Achieng" }, include: { guardians: { include: { guardian: true } } } });
  if (!achieng) throw new Error("Achieng not seeded");
  const guardianUserId = achieng.guardians.map((g) => g.guardian.userId).find(Boolean);
  if (!guardianUserId) throw new Error("Achieng has no linked parent user");
  const parentUser = await db.user.findUnique({ where: { id: guardianUserId } });
  if (!parentUser) throw new Error("parent user missing");

  const parent = {
    id: parentUser.id, tenantId: parentUser.tenantId, neyoLoginId: "test",
    fullName: parentUser.fullName, phone: parentUser.phone, email: parentUser.email,
    role: parentUser.role as any, secondaryRole: parentUser.secondaryRole as any, language: "en",
  };

  // ---- 1) guardian can load a full dashboard ----
  const dash = await getParentGrowthDashboard(parent, achieng.id);
  assert(dash.child.id === achieng.id, "dashboard returns the child");
  assert(dash.summary, "summary roll-up present");
  assert("attendance" in dash && "behavior" in dash && "portfolio" in dash && "feedbackDigest" in dash && "upcomingAssessments" in dash, "all data layers present");
  assert(dash.goals.length >= 1, "seeded teacher goal present");
  assert(dash.upcomingAssessments.length >= 1, "seeded parent-visible upcoming assessment present (PUBLISHED bug fixed)");
  assert(dash.goalAckEnabled === true, "goal ack enabled by seed");

  // approved-only safety: every competency shown must be approved + visible
  await withTenant(tenant.id, async () => {
    for (const c of dash.competencies) {
      const row = await tenantDb().competencyEvidence.findUnique({ where: { id: c.id } });
      assert(row && row.approved && row.visibleToParents, "every shown competency must be approved + parent-visible");
    }
    for (const p of dash.portfolio) {
      const row = await tenantDb().portfolioItem.findUnique({ where: { id: p.id } });
      assert(row && row.status === "APPROVED" && row.visibleToParents, "every portfolio highlight must be approved + parent-visible");
    }
  });

  // ---- 2) a NON-guardian parent is blocked ----
  const otherParent = await db.user.findFirst({ where: { tenantId: tenant.id, role: "PARENT", id: { not: parentUser.id } } });
  if (otherParent) {
    let blocked = false;
    try {
      await getParentGrowthDashboard({ ...parent, id: otherParent.id, fullName: otherParent.fullName }, achieng.id);
    } catch (e) { blocked = e instanceof GrowthError; }
    assert(blocked, "a non-guardian parent must be blocked from the child's dashboard");
  }

  // ---- 3) acknowledge a goal (guardian) ----
  const goal = dash.goals.find((g) => !g.acknowledgedByParent) || dash.goals[0];
  await acknowledgeStudentGoal(parent, goal.id);
  const after = await getParentGrowthDashboard(parent, achieng.id);
  assert(after.goals.find((g) => g.id === goal.id)?.acknowledgedByParent === true, "goal must be acknowledged after parent action");

  // ---- 4) feature flag gate ----
  await withTenant(tenant.id, async () => {
    assert(await isGoalAckEnabled() === true, "ack enabled");
    // turn OFF
    await tenantDb().tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "parent_goal_ack" } }, update: { enabled: false }, create: { tenantId: tenant.id, moduleKey: "parent_goal_ack", enabled: false } });
    assert(await isGoalAckEnabled() === false, "ack now disabled");
  });
  let disabled = false;
  try { await acknowledgeStudentGoal(parent, goal.id); } catch (e) { disabled = e instanceof GrowthError && (e as GrowthError).code === "DISABLED"; }
  assert(disabled, "acknowledging must be refused when the school disables the feature");
  // restore ON
  await withTenant(tenant.id, async () => {
    await tenantDb().tenantModule.update({ where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "parent_goal_ack" } }, data: { enabled: true } });
  });

  console.log("✓ J.13 full-stack test passed: mounted growth tab + attendance/behavior/portfolio/feedback + fixed upcoming assessments + approved-only safety + guardian guard + goal ack + school-enable flag.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
