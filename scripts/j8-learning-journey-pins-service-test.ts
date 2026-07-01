import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import type { SessionUser } from "../src/lib/core/session";
import {
  getLearnerJourneyTimeline,
  LearnerJourneyError,
  pinLearnerJourneyMilestone,
  unpinLearnerJourneyMilestone,
} from "../src/lib/services/learner-journey.service";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof db.user.findFirst>>>): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: (user.secondaryRole as SessionUser["secondaryRole"]) ?? null,
    language: user.language ?? "en",
  };
}

async function main() {
  console.log("Starting J.8 pinned milestones service test...");

  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const teacher = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }));
  const parent = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }));
  const accountant = toSessionUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "accounts@karibuhigh.ac.ke" } }));

  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });
  const timeline = await getLearnerJourneyTimeline(principal, { studentId: student.id, mode: "staff", limit: 50 });
  const pinTarget = timeline.entries.find((entry) => entry.sourceModule === "EXAM") ?? timeline.entries[0];

  if (!pinTarget) throw new Error("Expected at least one learner journey entry to pin.");

  await withTenant(tenant.id, async () => {
    await tenantDb().learnerJourneyPin.deleteMany({ where: { studentId: student.id, entryId: pinTarget.id } });
  });

  await pinLearnerJourneyMilestone(principal, {
    studentId: student.id,
    entryId: pinTarget.id,
    sourceModule: pinTarget.sourceModule,
    note: "Flag for parent meeting",
    visibility: "STAFF",
  });

  const created = await withTenant(tenant.id, async () => tenantDb().learnerJourneyPin.findFirst({ where: { studentId: student.id, entryId: pinTarget.id } }));
  if (!created) throw new Error("Principal pin should create learnerJourneyPin row.");
  if (created.note !== "Flag for parent meeting") throw new Error("Pin note should be stored.");
  console.log("✓ leadership can pin a real learner journey milestone");

  await pinLearnerJourneyMilestone(teacher, {
    studentId: student.id,
    entryId: pinTarget.id,
    sourceModule: pinTarget.sourceModule,
    note: "Updated teaching follow-up note",
    visibility: "STAFF",
  });

  const updated = await withTenant(tenant.id, async () => tenantDb().learnerJourneyPin.findFirst({ where: { studentId: student.id, entryId: pinTarget.id } }));
  if (!updated) throw new Error("Teacher repin should keep learnerJourneyPin row.");
  if (updated.note !== "Updated teaching follow-up note") throw new Error("Repin should update the note rather than duplicating.");
  console.log("✓ teacher repin updates the existing milestone pin without duplication");

  const hydratedStaffTimeline = await getLearnerJourneyTimeline(principal, { studentId: student.id, mode: "staff", limit: 50 });
  const hydratedPinnedEntry = hydratedStaffTimeline.entries.find((entry) => entry.id === pinTarget.id);
  if (!hydratedPinnedEntry?.pinned) throw new Error("Pinned learner journey entry should hydrate back into the staff timeline.");
  if (hydratedPinnedEntry.pinNote !== "Updated teaching follow-up note") throw new Error("Hydrated pinned entry should include the saved pin note.");
  if (hydratedPinnedEntry.pinVisibility !== "STAFF") throw new Error("Hydrated pinned entry should include the saved pin visibility.");
  console.log("✓ staff learner journey hydrates persisted pin state back into timeline entries");

  await pinLearnerJourneyMilestone(accountant as never, {
    studentId: student.id,
    entryId: pinTarget.id,
    sourceModule: pinTarget.sourceModule,
    note: "Should not work",
    visibility: "STAFF",
  }).then(() => {
    throw new Error("Accountant should not be allowed to pin milestones.");
  }).catch((error) => {
    if (!(error instanceof LearnerJourneyError) || error.code !== "FORBIDDEN") throw error;
    console.log("✓ accountant is blocked from milestone pinning");
  });

  await pinLearnerJourneyMilestone(parent as never, {
    studentId: student.id,
    entryId: pinTarget.id,
    sourceModule: pinTarget.sourceModule,
    note: "Parent should not pin",
    visibility: "PARENT_SAFE",
  }).then(() => {
    throw new Error("Parent should not be allowed to pin milestones.");
  }).catch((error) => {
    if (!(error instanceof LearnerJourneyError) || error.code !== "FORBIDDEN") throw error;
    console.log("✓ parent is blocked from milestone pinning");
  });

  await pinLearnerJourneyMilestone(principal, {
    studentId: student.id,
    entryId: "not-a-real-journey-entry",
    sourceModule: pinTarget.sourceModule,
    note: "Fake entry",
    visibility: "STAFF",
  }).then(() => {
    throw new Error("Fake learner timeline entries should not be pinnable.");
  }).catch((error) => {
    if (!(error instanceof LearnerJourneyError) || error.code !== "INVALID") throw error;
    console.log("✓ service blocks pinning entries that are not in the learner journey timeline");
  });

  await unpinLearnerJourneyMilestone(principal, {
    studentId: student.id,
    entryId: pinTarget.id,
  });

  const deleted = await withTenant(tenant.id, async () => tenantDb().learnerJourneyPin.findFirst({ where: { studentId: student.id, entryId: pinTarget.id } }));
  if (deleted) throw new Error("Unpin should remove learnerJourneyPin row.");
  const postUnpinTimeline = await getLearnerJourneyTimeline(principal, { studentId: student.id, mode: "staff", limit: 50 });
  const unpinnedEntry = postUnpinTimeline.entries.find((entry) => entry.id === pinTarget.id);
  if (unpinnedEntry?.pinned) throw new Error("Unpinned learner journey entry should no longer hydrate as pinned.");
  console.log("✓ leadership can unpin learner journey milestones");

  await unpinLearnerJourneyMilestone(principal, {
    studentId: student.id,
    entryId: pinTarget.id,
  }).then(() => {
    throw new Error("Second unpin should fail when the pin is already gone.");
  }).catch((error) => {
    if (!(error instanceof LearnerJourneyError) || error.code !== "NOT_FOUND") throw error;
    console.log("✓ unpin returns not found once the milestone is already removed");
  });

  console.log("J.8 pinned milestones service test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
