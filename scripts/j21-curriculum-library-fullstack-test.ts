/**
 * J.21 — NEYO Ops Curriculum Template Library — full-stack proof.
 *
 * Proves, against the REAL repo (services + DB + validation + flags), that:
 *  1. NEYO Ops can CREATE a company-level template (audit logged).
 *  2. NEYO Ops can PUBLISH it to schools (publishedAt + audit logged).
 *  3. A school can ADOPT it — creating a local DRAFT it can customise (audit logged,
 *     wrapped in withTenant, remembering the adopted template + version).
 *  4. NEYO Ops can ANNOUNCE an update; the school sees "update available".
 *  5. Audit logs exist for publish AND adoption.
 *  6. Part-J features can be switched OFF/ON in NEYO Ops; default is ON. When J.21
 *     is OFF, the school library guard blocks access; switching ON restores it.
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import {
  upsertGlobalTemplate,
  adoptCurriculumTemplate,
  announceTemplateUpdate,
  getGlobalTemplates,
  getTemplateUpdatesForSchool,
  GlobalTemplateError,
} from "../src/lib/services/global-curriculum.service";
import {
  isJFeaturePaused,
  assertJFeatureEnabled,
  listJFeatureFlags,
  setFlag,
  FlagError,
} from "../src/lib/services/platform-flags.service";
import { jFeatureKey } from "../src/lib/core/j-features";

function sessionFrom(u: any) {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as any, secondaryRole: u.secondaryRole as any, language: u.language as any,
  };
}

async function main() {
  const ops = sessionFrom(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = sessionFrom(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));

  // Clean any leftovers from a prior run.
  await db.globalCurriculumTemplate.deleteMany({ where: { name: { startsWith: "J21 Test" } } });
  await withTenant(principal.tenantId, async () => {
    const tDb = tenantDb();
    const stale = await tDb.curriculum.findMany({ where: { name: { startsWith: "J21 Test" } } });
    for (const c of stale) await tDb.learningArea.deleteMany({ where: { curriculumId: c.id } });
    await tDb.curriculum.deleteMany({ where: { name: { startsWith: "J21 Test" } } });
  });
  await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.21") } });

  // ---- 1. Create a DRAFT template (audit logged) ----
  const draftTpl = await upsertGlobalTemplate(ops, {
    name: "J21 Test CBC Junior",
    country: "Kenya",
    context: "Junior School",
    version: "2026 Release",
    description: "Official KICD Junior School structure.",
    status: "DRAFT",
    changeNote: null,
    learningAreas: [
      { name: "Mathematics", code: "MAT", description: "Core math" },
      { name: "English Language", code: "ENG", description: "Core language" },
    ],
  } as any);
  assert.equal(draftTpl.status, "DRAFT", "new template starts as DRAFT");
  assert.equal(draftTpl.publishedAt, null, "draft has no publishedAt");
  const createdAudit = await db.auditLog.findFirst({ where: { action: "curriculum.template_created", entityId: draftTpl.id } });
  assert(createdAudit, "creating a template must write an audit log");

  // Non-ops user must be rejected.
  await assert.rejects(() => upsertGlobalTemplate(principal, { ...draftTpl, learningAreas: [] } as any),
    (e) => e instanceof GlobalTemplateError && e.code === "FORBIDDEN", "non-ops user cannot manage templates");

  // ---- 2. Publish it (publishedAt + audit) ----
  const published = await upsertGlobalTemplate(ops, {
    name: "J21 Test CBC Junior", country: "Kenya", context: "Junior School", version: "2026 Release",
    description: "Official KICD Junior School structure.", status: "PUBLISHED", changeNote: null,
    learningAreas: [
      { name: "Mathematics", code: "MAT", description: "Core math" },
      { name: "English Language", code: "ENG", description: "Core language" },
    ],
  } as any, draftTpl.id);
  assert.equal(published.status, "PUBLISHED", "template is now published");
  assert(published.publishedAt, "publishedAt is stamped on first publish");
  const publishAudit = await db.auditLog.findFirst({ where: { action: "curriculum.template_published", entityId: published.id } });
  assert(publishAudit, "publishing a template must write an audit log");

  // School only sees PUBLISHED templates in the library.
  const library = await getGlobalTemplates(principal, true);
  assert(library.some((t) => t.id === published.id), "published template appears in the school library");

  // ---- 3. School adopts it → local DRAFT, audit, adopted fields ----
  const adopted = await adoptCurriculumTemplate(principal, published.id);
  assert.equal(adopted.status, "DRAFT", "adoption creates a local DRAFT (intentional)");
  assert.equal(adopted.adoptedTemplateId, published.id, "adopted curriculum remembers the template id");
  assert.equal(adopted.adoptedTemplateVersion, "2026 Release", "adopted curriculum remembers the template version");
  // rename so cleanup is easy + it does not collide with seed
  await withTenant(principal.tenantId, async () => {
    await tenantDb().curriculum.update({ where: { id: adopted.id }, data: { name: `J21 Test Adopted ${adopted.id.slice(-4)}` } });
  });
  const adoptAudit = await db.auditLog.findFirst({ where: { action: "curriculum.template_adopted", entityId: adopted.id } });
  assert(adoptAudit, "adoption must write an audit log");

  // No update available yet (school has the latest version).
  const before = await getTemplateUpdatesForSchool(principal);
  assert(!before.some((u) => u.templateId === published.id), "no update should be flagged before the template version changes");

  // ---- 4. Ops publishes a NEW version + announces it; school sees update ----
  await upsertGlobalTemplate(ops, {
    name: "J21 Test CBC Junior", country: "Kenya", context: "Junior School", version: "2027 Release",
    description: "Updated structure.", status: "PUBLISHED", changeNote: null,
    learningAreas: [
      { name: "Mathematics", code: "MAT", description: "Core math" },
      { name: "English Language", code: "ENG", description: "Core language" },
      { name: "Coding & Robotics", code: "CODE", description: "New area" },
    ],
  } as any, published.id);
  const announced = await announceTemplateUpdate(ops, published.id, "Added Coding & Robotics for 2027.");
  assert(announced.announcedAt, "announce stamps announcedAt");
  assert.equal(announced.changeNote, "Added Coding & Robotics for 2027.", "announce records the change note");
  const announceAudit = await db.auditLog.findFirst({ where: { action: "curriculum.template_announced", entityId: published.id } });
  assert(announceAudit, "announcing must write an audit log");

  const after = await getTemplateUpdatesForSchool(principal);
  const update = after.find((u) => u.templateId === published.id);
  assert(update, "school must now see an available update");
  assert.equal(update!.adoptedVersion, "2026 Release", "shows the version the school adopted");
  assert.equal(update!.latestVersion, "2027 Release", "shows the latest published version");
  assert.equal(update!.updateAvailable, true, "update is flagged as available");

  // ---- 6. Feature toggle: default ON, can switch OFF/ON ----
  assert.equal(await isJFeaturePaused("J.21"), false, "Part-J features default to ON (not paused)");
  let flags = await listJFeatureFlags();
  const j21 = flags.find((f) => f.id === "J.21");
  assert(j21 && j21.enabled === true, "J.21 listed as enabled by default");

  // Guard passes while ON.
  await assertJFeatureEnabled("J.21");

  // Switch OFF via the same platform-flag service the Ops API uses.
  await setFlag(ops, jFeatureKey("J.21"), true, "Staging before launch");
  assert.equal(await isJFeaturePaused("J.21"), true, "J.21 now switched OFF");
  await assert.rejects(() => assertJFeatureEnabled("J.21"),
    (e) => e instanceof FlagError && e.code === "FORBIDDEN", "guard blocks the feature while OFF");
  const offFlag = (await listJFeatureFlags()).find((f) => f.id === "J.21");
  assert(offFlag && offFlag.enabled === false, "J.21 listed as disabled while OFF");

  // Switch back ON (default state for now).
  await setFlag(ops, jFeatureKey("J.21"), false, null as any);
  assert.equal(await isJFeaturePaused("J.21"), false, "J.21 switched back ON");
  await assertJFeatureEnabled("J.21");

  // ---- cleanup ----
  await db.globalCurriculumTemplate.deleteMany({ where: { name: { startsWith: "J21 Test" } } });
  await withTenant(principal.tenantId, async () => {
    const tDb = tenantDb();
    const made = await tDb.curriculum.findMany({ where: { name: { startsWith: "J21 Test" } } });
    for (const c of made) await tDb.learningArea.deleteMany({ where: { curriculumId: c.id } });
    await tDb.curriculum.deleteMany({ where: { name: { startsWith: "J21 Test" } } });
  });
  await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.21") } });

  console.log("PASS J21 NEYO Ops curriculum template library fullstack");
}

main()
  .catch((e) => { console.error("FAIL J21:", e); process.exit(1); })
  .finally(() => db.$disconnect());
