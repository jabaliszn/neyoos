import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import type { SessionUser } from "../src/lib/core/session";
import {
  getSkillsPassportProfile,
  recordSkillRating,
  removeSkillRating,
  SkillsPassportError,
} from "../src/lib/services/skills-passport.service";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return { id: user.id, tenantId: user.tenantId, neyoLoginId: user.neyoLoginId, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role as SessionUser["role"], secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null, language: user.language ?? "en" };
}

async function main() {
  console.log("Starting J.6 Skills Passport service test...");
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const teacherRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });
  const accountantRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } });
  const parentRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } });

  const principal = toSessionUser(principalRow);
  const teacher = toSessionUser(teacherRow);
  const accountant = toSessionUser(accountantRow);
  const parent = toSessionUser(parentRow);

  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const otherStudent = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Kamau" } });

  await withTenant(tenant.id, async () => {
    // 1. Verify accountant is forbidden from reading skills passport
    await getSkillsPassportProfile(accountant, student.id).then(() => { throw new Error("Accountant should be forbidden"); }).catch((e) => {
      if (e instanceof SkillsPassportError && e.code === "FORBIDDEN") console.log("✓ Accountant correctly forbidden from reading Skills Passport");
      else throw e;
    });

    // 2. Verify parent row-scoping (can read own child, forbidden/not-found on other child)
    const parentProfile = await getSkillsPassportProfile(parent, student.id);
    console.log(`✓ parent successfully fetched Skills Passport for own child (${parentProfile.student.name})`);
    if (parentProfile.canRecord) throw new Error("Parent should not be able to record skill ratings");

    await getSkillsPassportProfile(parent, otherStudent.id).then(() => { throw new Error("Parent should be blocked from other child"); }).catch((e) => {
      if (e instanceof SkillsPassportError && e.code === "NOT_FOUND") console.log("✓ parent correctly blocked from reading other child's Skills Passport (row scoping enforced)");
      else throw e;
    });

    // 3. Record skill ratings as principal
    const entry1 = await recordSkillRating(principal, {
      studentId: student.id,
      skillArea: "Leadership",
      ratingLevel: 5,
      evidenceSource: "CLUB",
      narrative: "Leads environmental club activities and coordinates tree planting drives.",
      evidenceDate: "2026-06-26",
      verified: true,
    });
    console.log("✓ recorded skill rating for Leadership (5 stars, source CLUB)");

    const entry2 = await recordSkillRating(principal, {
      studentId: student.id,
      skillArea: "Creativity",
      ratingLevel: 4,
      evidenceSource: "AWARD",
      narrative: "Won 2nd prize in the county inter-school art competition.",
      evidenceDate: "2026-06-27",
      verified: true,
    });
    console.log("✓ recorded skill rating for Creativity (4 stars, source AWARD)");

    // Verify parent cannot record ratings
    await recordSkillRating(parent, { studentId: student.id, skillArea: "Music", ratingLevel: 5, evidenceSource: "OBSERVATION", evidenceDate: "2026-06-27" })
      .then(() => { throw new Error("Parent should not be able to record ratings"); })
      .catch((e) => {
        if (e instanceof SkillsPassportError && e.code === "FORBIDDEN") console.log("✓ parent correctly forbidden from recording skill ratings");
        else throw e;
      });

    // 4. Fetch full Skills Passport profile and verify aggregation
    const profile = await getSkillsPassportProfile(principal, student.id);
    if (!profile.canRecord) throw new Error("Principal should be able to record");
    console.log(`✓ fetched Skills Passport profile for ${profile.student.name}`);
    console.log(`  - Academic Growth: ${profile.academicGrowth.exams.length} exams, ${profile.academicGrowth.flexibleAssessments.length} flexible assessments`);
    console.log(`  - Competency Growth: ${profile.competencyGrowth.length} competency evidence points`);
    console.log(`  - Talent & Leadership: ${profile.talentAndLeadership.length} skill areas`);
    console.log(`  - Total Evidence Summary Points: ${profile.summary.totalPoints}`);

    if (profile.talentAndLeadership.length < 2) throw new Error("Talent and leadership aggregation incorrect");

    // 5. Remove a skill rating
    await removeSkillRating(principal, entry2.id);
    console.log("✓ removed skill rating successfully");

    // 6. Verify audit logs
    const recentAudits = await tenantDb().auditLog.findMany({
      where: { action: { in: ["skills_passport.rating_recorded", "skills_passport.rating_removed"] } },
    });
    if (recentAudits.length < 2) throw new Error("Audit logs not generated correctly.");
    console.log(`✓ audit logs verified (${recentAudits.length} events recorded across skills passport lifecycle)`);

    // 7. Clean up test data
    await tenantDb().skillsPassportEntry.deleteMany({ where: { studentId: student.id } });
    console.log("✓ cleaned up test data cleanly");
  });

  console.log("J.6 Chunk 3 Skills Passport service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
