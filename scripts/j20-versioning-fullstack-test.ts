/**
 * J.20 — Future-Proof Configuration & Versioning — full-stack proof.
 *
 * Proves, against the REAL repo (services + DB + validation + UI), that:
 *  1. Curriculum is versioned (draft clone of the active version).
 *  2. A school can preview a future curriculum diff BEFORE switching.
 *  3. The migration assistant shows added/removed/renamed areas + impact.
 *  4. Publishing archives the old version (kept for historical reports) and
 *     activates the new one with an effective-from date.
 *  5. Report templates are versioned with effective dates + curriculum version,
 *     and historical reports resolve the version that was effective at the time.
 *  6. Assessment types are versioned with effective dates.
 *  7. The versioning workflow writes audit logs.
 *  8. The UI surface is mounted and uses only valid Badge/Button props.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { db } from "../src/lib/db";
import {
  createDraftVersion,
  previewCurriculumDiff,
  publishDraftVersion,
  getCurriculumVersions,
} from "../src/lib/services/curriculum-versioning.service";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  createReportTemplate,
  findHistoricalReportTemplate,
} from "../src/lib/services/report-template.service";
import { createAssessmentType } from "../src/lib/services/assessment.service";

function sessionFrom(u: any) {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as any,
    secondaryRole: u.secondaryRole as any,
    language: u.language as any,
  };
}

async function main() {
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = sessionFrom(principal);

  // ---- Clean up any leftovers from a previous test run (idempotent) ----
  await withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    // Remove stale drafts/archives created by this test.
    const stale = await tDb.curriculum.findMany({
      where: { tenantId: user.tenantId, activeVersion: { in: ["J20-TEST-DRAFT", "2099"] } },
    });
    for (const c of stale) {
      await tDb.learningArea.deleteMany({ where: { curriculumId: c.id } });
    }
    await tDb.curriculum.deleteMany({ where: { tenantId: user.tenantId, activeVersion: { in: ["J20-TEST-DRAFT", "2099"] } } });
    await tDb.reportTemplate.deleteMany({ where: { name: { startsWith: "J20 Test" } } });
    await tDb.assessmentType.deleteMany({ where: { key: "J20TEST" } });
  });

  // ---- 1. Versioned curriculum: clone active version into a DRAFT ----
  const active = await withTenant(user.tenantId, async () =>
    tenantDb().curriculum.findFirstOrThrow({ where: { status: "ACTIVE", name: "CBC Kenya" } })
  );
  const baseVersion = active.activeVersion;

  // Remove any draft already hanging off this version (e.g. from an interrupted run).
  await withTenant(user.tenantId, async () => {
    const tDb = tenantDb();
    const orphanDrafts = await tDb.curriculum.findMany({ where: { previousVersionId: active.id, status: "DRAFT" } });
    for (const od of orphanDrafts) {
      await tDb.learningArea.deleteMany({ where: { curriculumId: od.id } });
      await tDb.curriculum.delete({ where: { id: od.id } });
    }
  });

  // The publish step archives `active` and creates a new ACTIVE version. We track
  // the new version's id so the finally-block can ALWAYS restore the seed even if
  // an assertion fails mid-run.
  let publishedId: string | null = null;
  try {
  const draft = await createDraftVersion(user, active.id, "J20-TEST-DRAFT");
  assert.equal(draft.status, "DRAFT", "new version must be a DRAFT");
  assert.equal(draft.isActive, false, "draft must not be active");
  assert.equal(draft.previousVersionId, active.id, "draft must point back to the active version");
  assert.equal(draft.activeVersion, "J20-TEST-DRAFT", "draft must carry the new version label");

  // ---- 2 + 3. Edit the draft and PREVIEW the diff before switching ----
  await withTenant(user.tenantId, async () => {
    await tenantDb().learningArea.create({
      data: { tenantId: user.tenantId, curriculumId: draft.id, name: "Coding & Robotics", code: "CODE-J20" },
    });
  });

  const diff = await previewCurriculumDiff(user, draft.id);
  assert.equal(diff.baseVersion, baseVersion, "diff base version should match the active version");
  assert.equal(diff.draftVersion, "J20-TEST-DRAFT", "diff draft version should match the new version");
  assert(diff.added.some((a) => a.code === "CODE-J20"), "diff must show the newly added learning area");
  assert.equal(diff.hasStructuralChanges, true, "diff must flag structural changes");
  assert(diff.impact && typeof diff.impact.warning === "string", "diff must include an impact warning");
  assert(diff.impact.warning.toLowerCase().includes("historical") || diff.impact.warning.toLowerCase().includes("report"),
    "impact warning must explain historical reports keep their version");

  // ---- 4. Publish: old archived (kept), new active with effective-from ----
  const published = await publishDraftVersion(user, draft.id);
  publishedId = published.id;
  assert.equal(published.status, "ACTIVE", "published version must be ACTIVE");
  assert.equal(published.isActive, true, "published version must be active");
  assert(published.effectiveFrom, "published version must have an effective-from date");

  const archived = await withTenant(user.tenantId, async () =>
    tenantDb().curriculum.findUniqueOrThrow({ where: { id: active.id } })
  );
  assert.equal(archived.status, "ARCHIVED", "the old version must be ARCHIVED, not deleted (kept for history)");
  assert.equal(archived.isActive, false, "old version must no longer be active");
  assert(archived.effectiveTo, "old version must record an effective-to date when retired");

  // ---- 5. Report templates versioned with effective dates + curriculum version ----
  const oldTemplate = await createReportTemplate(user, {
    name: "J20 Test Old Report",
    description: "Pinned to the old curriculum.",
    isDefault: false,
    version: "v1",
    effectiveFrom: "2025-01-01",
    effectiveTo: "2025-12-31",
    curriculumVersion: baseVersion,
    sections: [{ id: "h1", type: "HEADER", config: {} }],
  } as any);
  assert.equal(oldTemplate.version, "v1", "report template must persist version");
  assert.equal(oldTemplate.effectiveFrom, "2025-01-01", "report template must persist effectiveFrom");
  assert.equal(oldTemplate.effectiveTo, "2025-12-31", "report template must persist effectiveTo");
  assert.equal(oldTemplate.curriculumVersion, baseVersion, "report template must persist curriculumVersion");

  const newTemplate = await createReportTemplate(user, {
    name: "J20 Test New Report",
    description: "Pinned to the new curriculum.",
    isDefault: false,
    version: "v2",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    curriculumVersion: "J20-TEST-DRAFT",
    sections: [{ id: "h1", type: "HEADER", config: {} }],
  } as any);
  assert.equal(newTemplate.version, "v2", "second template version persisted");

  // Historical report resolution: a report issued in 2025 must resolve the OLD,
  // version-pinned template — proving history keeps the version used at the time.
  const historical = await findHistoricalReportTemplate(user, "2025-06-30", baseVersion);
  assert(historical, "historical report template lookup should return a template");
  assert.equal(historical!.id, oldTemplate.id, "a 2025-dated report must resolve the OLD version-pinned template");

  // ---- 6. Assessment types versioned with effective dates ----
  const at = await createAssessmentType(user, {
    key: "J20TEST",
    name: "J20 Versioned Practical",
    description: "Effective-dated assessment type.",
    category: "PRACTICAL",
    scoreMode: "RUBRIC",
    defaultWeight: 20,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2027-12-31",
    evidenceAllowed: true,
    requiresModeration: true,
    active: true,
  } as any);
  assert.equal((at as any).effectiveFrom, "2026-01-01", "assessment type must persist effectiveFrom");
  assert.equal((at as any).effectiveTo, "2027-12-31", "assessment type must persist effectiveTo");

  // ---- 7. Audit logging for the versioning workflow ----
  const drafted = await db.auditLog.findFirst({ where: { tenantId: user.tenantId, action: "curriculum.version_drafted", entityId: draft.id } });
  assert(drafted, "drafting a version must write an audit log");
  const pubAudit = await db.auditLog.findFirst({ where: { tenantId: user.tenantId, action: "curriculum.version_published", entityId: published.id } });
  assert(pubAudit, "publishing a version must write an audit log");

  // ---- 8. UI surface mounted + only valid component props ----
  const ui = fs.readFileSync("src/components/academics/curriculum-version-manager.tsx", "utf8");
  assert(!/Badge\s+variant=/.test(ui), "Badge must use 'tone', never 'variant'");
  assert(!/variant="outline"/.test(ui), "Button must not use the invalid 'outline' variant");
  assert(ui.includes("/api/curriculum/versions"), "version manager must call the real versions API");
  assert(ui.includes("Preview Diff"), "version manager must expose the migration preview action");

  // The version manager renders inside modals; the shared Dialog primitive it
  // imports must actually exist (it was previously missing, breaking the build).
  assert(fs.existsSync("src/components/ui/dialog.tsx"), "shared ui/dialog primitive must exist");
  const dialog = fs.readFileSync("src/components/ui/dialog.tsx", "utf8");
  for (const exp of ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogFooter"]) {
    assert(new RegExp(`export function ${exp}\\b`).test(dialog), `ui/dialog must export ${exp}`);
  }

  const client = fs.readFileSync("src/components/academics/academics-client.tsx", "utf8");
  assert(client.includes("CurriculumVersionManagerClient"), "version manager must be mounted in academics client");
  assert(client.includes("curriculum-versions"), "version manager tab must be wired");

  const route = fs.readFileSync("src/app/api/curriculum/versions/route.ts", "utf8");
  assert(route.includes('requirePermission("academics.view")'), "GET route must guard with academics.view");
  assert(route.includes('requirePermission("academics.manage")'), "POST route must guard with academics.manage");

  // Service must establish tenant context (no tenantDb() outside withTenant()).
  const svc = fs.readFileSync("src/lib/services/curriculum-versioning.service.ts", "utf8");
  assert(svc.includes("withTenant(user.tenantId"), "versioning service must wrap tenantDb() in withTenant()");

  // Verify diff is now visible in the version list (post-publish ordering).
  const versions = await getCurriculumVersions(user);
  assert(versions.some((v) => v.activeVersion === "J20-TEST-DRAFT" && v.status === "ACTIVE"), "published version should be active in list");

    console.log("PASS J20 future-proof configuration & versioning fullstack");
  } finally {
    // ---- ALWAYS restore so the seed stays clean even on assertion failure ----
    await withTenant(user.tenantId, async () => {
      const tDb = tenantDb();
      await tDb.reportTemplate.deleteMany({ where: { name: { startsWith: "J20 Test" } } });
      await tDb.assessmentType.deleteMany({ where: { key: "J20TEST" } });
      // Re-activate the original curriculum.
      await tDb.curriculum.update({ where: { id: active.id }, data: { status: "ACTIVE", isActive: true, effectiveTo: null } });
      // Remove the published test version (and any orphan drafts left behind).
      if (publishedId) {
        await tDb.learningArea.deleteMany({ where: { curriculumId: publishedId } });
        await tDb.curriculum.deleteMany({ where: { id: publishedId } });
      }
      const orphanDrafts = await tDb.curriculum.findMany({ where: { previousVersionId: active.id, status: "DRAFT" } });
      for (const od of orphanDrafts) {
        await tDb.learningArea.deleteMany({ where: { curriculumId: od.id } });
        await tDb.curriculum.delete({ where: { id: od.id } });
      }
    });
  }
}

main()
  .catch((e) => {
    console.error("FAIL J20:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
