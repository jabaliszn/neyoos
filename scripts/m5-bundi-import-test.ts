/**
 * M.5 — Bundi Handwritten Import: full-stack live test.
 *
 * Proves (real DB, real service calls, real assertions):
 *  1. NEYO Ops provider config save/reload (default OFF, honest).
 *  2. Unlock-code minting: school-specific one-time code, standing (unlimited)
 *     code, and revocation — all real DB rows, not mocks.
 *  3. Code validity rules enforced for real: wrong school, expired, revoked,
 *     used-up (maxUses reached), unknown code — every rejection real.
 *  4. School field-template save/reload (their own register description).
 *  5. Starting a session consumes exactly one use of the code (real
 *     increment), and blocks pageCount above NEYO Ops' configured cap.
 *  6. Extraction correctly refuses to run (NOT_CONFIGURED) while no real
 *     provider is enabled — NEVER fabricates rows. Session flips to FAILED
 *     with a real, honest error message.
 *  7. Once a session is FAILED (extraction blocked), it can be reviewed only
 *     after real extraction — the review/commit endpoints correctly refuse a
 *     session that never reached REVIEW status (no shortcut around the gate).
 *  8. A full end-to-end path IS possible once extraction is manually
 *     simulated at the DB layer (proving the review -> commit -> real
 *     Student rows path works end-to-end through the SAME commitImport()
 *     used by the standard engine, with real StudentCustomField rows for a
 *     "custom" mapped column) — proves the pipeline is real, only the AI
 *     call itself is the (correctly) unconfigured seam.
 *  9. NEYO Ops usage dashboard reflects real cost/session aggregates.
 * 10. Cancelling a session works; a committed session cannot be cancelled.
 *
 * Full cleanup in a finally block; safe to run repeatedly.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  getBundiProviderConfig,
  saveBundiProviderConfig,
  mintUnlockCode,
  revokeUnlockCode,
  checkUnlockCode,
  saveFieldTemplate,
  getFieldTemplate,
  startImportSession,
  extractSession,
  reviewSession,
  commitSession,
  cancelSession,
  bundiUsageDashboard,
  BundiImportError,
} from "../src/lib/services/bundi-import.service";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}
async function expectError(fn: () => Promise<unknown>, code: string, label: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof BundiImportError && e.code === code, `${label} (got: ${e instanceof Error ? e.message : e})`);
    return;
  }
  throw new Error(`Expected ${code}: ${label}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  console.log("M.5 Bundi handwritten import \u2014 full-stack test");

  const adminRaw = await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
  const admin = asUser(adminRaw);
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const otherTenant = await db.tenant.findFirstOrThrow({ where: { id: { not: principal.tenantId } } });

  const createdCodeIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdStudentIds: string[] = [];

  try {
    // Start from a clean slate: this test itself writes config in earlier
    // runs, so reset before asserting defaults (idempotent re-run safety).
    await db.platformSetting.deleteMany({ where: { key: "neyo_bundi_provider_config" } });

    // 1) Provider config
    const defaultConfig = await getBundiProviderConfig();
    assert(defaultConfig.enabled === false, "provider config defaults to OFF (honest, no fake extraction ever)");
    assert(defaultConfig.provider === "NONE", "provider defaults to NONE");

    const savedConfig = await saveBundiProviderConfig({ enabled: false, provider: "OPENAI_VISION", model: "gpt-4o", usdToKes: 145, maxPagesPerSession: 2 }, admin);
    assert(savedConfig.usdToKes === 145 && savedConfig.maxPagesPerSession === 2, "provider config saves real non-default values");
    const reloadedConfig = await getBundiProviderConfig();
    assert(reloadedConfig.model === "gpt-4o" && reloadedConfig.maxPagesPerSession === 2, "provider config persists across reload");

    // 2) Unlock code minting
    const schoolCode = await mintUnlockCode({ tenantId: principal.tenantId, maxUses: 1, note: "test one-time code" }, admin);
    createdCodeIds.push(schoolCode.id);
    assert(schoolCode.code.startsWith("BUNDI-"), "minted code has the real BUNDI- prefix");
    assert(schoolCode.maxUses === 1, "one-time code has maxUses=1");

    const standingCode = await mintUnlockCode({ tenantId: principal.tenantId, maxUses: null, note: "standing approval" }, admin);
    createdCodeIds.push(standingCode.id);
    assert(standingCode.maxUses === null, "standing-approval code has maxUses=null (unlimited until revoked)");

    // 3) Validity rules
    await expectError(() => checkUnlockCode(otherTenant.id, schoolCode.code), "FORBIDDEN", "a school-specific code is rejected for a DIFFERENT school");
    const validCheck = await checkUnlockCode(principal.tenantId, schoolCode.code);
    assert(validCheck.valid && validCheck.remainingUses === 1, "a valid code for the right school checks out with correct remaining uses");

    await expectError(() => checkUnlockCode(principal.tenantId, "BUNDI-DOESNOTEXIST"), "NOT_FOUND", "an unknown code is rejected");

    const revokedCode = await mintUnlockCode({ tenantId: principal.tenantId, note: "to be revoked" }, admin);
    createdCodeIds.push(revokedCode.id);
    await revokeUnlockCode(revokedCode.id, admin);
    await expectError(() => checkUnlockCode(principal.tenantId, revokedCode.code), "EXPIRED", "a revoked code is rejected");
    await expectError(() => revokeUnlockCode(revokedCode.id, admin), "STATE", "re-revoking an already-revoked code is rejected");

    const expiredCode = await mintUnlockCode({ tenantId: principal.tenantId, expiresInDays: 1, note: "will be backdated" }, admin);
    createdCodeIds.push(expiredCode.id);
    await db.bundiImportUnlockCode.update({ where: { id: expiredCode.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectError(() => checkUnlockCode(principal.tenantId, expiredCode.code), "EXPIRED", "an expired code is rejected");

    // 4) Field template
    const emptyTemplate = await getFieldTemplate(principal, "STUDENT");
    assert(Array.isArray(emptyTemplate.fields) && emptyTemplate.fields.length === 0, "a school with no saved template gets an empty array, not an error");

    const templateFields = [
      { label: "Jina (Name)", description: "Full name written in the first column", mapsTo: "fullName" },
      { label: "Jinsia", description: "M or F", mapsTo: "gender" },
      { label: "Nyumba", description: "Boarding house name", mapsTo: "custom", customLabel: "House" },
    ];
    const savedTemplate = await saveFieldTemplate(principal, { domain: "STUDENT", fields: templateFields as any });
    assert(savedTemplate.fields.length === 3, "field template saves all 3 school-described columns");
    const reloadedTemplate = await getFieldTemplate(principal, "STUDENT");
    assert((reloadedTemplate.fields as any[])[2].customLabel === "House", "field template persists the custom label across reload");

    // 5) Starting a session consumes one use + enforces the page cap
    await expectError(
      () => startImportSession(principal, { domain: "STUDENT", unlockCode: schoolCode.code, storedFileId: "does-not-exist", fileName: "test.jpg", pageCount: 5 }),
      "INVALID",
      "starting a session above the NEYO-Ops-configured page cap (2) is rejected"
    );

    // Create a real minimal StoredFile row to reference (bypassing actual
    // upload plumbing, which is tested by the pre-existing A.9 file tests).
    const fakeFile = await withTenant(principal.tenantId, () => db.storedFile.create({
      data: {
        tenantId: principal.tenantId, key: `tenants/${principal.tenantId}/bundi_import/test-scan.jpg`,
        url: "https://example.invalid/test-scan.jpg", fileName: "register-page-1.jpg", contentType: "image/jpeg",
        size: 12345, category: "bundi_import", uploadedById: principal.id,
      },
    }));

    const session = await startImportSession(principal, { domain: "STUDENT", unlockCode: schoolCode.code, storedFileId: fakeFile.id, fileName: "register-page-1.jpg", pageCount: 1 });
    createdSessionIds.push(session.id);
    assert(session.status === "UPLOADED", "new session starts in UPLOADED status");

    const afterStartCheck = await db.bundiImportUnlockCode.findUniqueOrThrow({ where: { id: schoolCode.id } });
    assert(afterStartCheck.usedCount === 1, "starting a session consumed exactly ONE real use of the code");
    await expectError(
      () => startImportSession(principal, { domain: "STUDENT", unlockCode: schoolCode.code, storedFileId: fakeFile.id, fileName: "register-page-2.jpg", pageCount: 1 }),
      "EXHAUSTED",
      "the one-time code cannot be reused after its single use is consumed"
    );

    // 6) Extraction refuses to run while unconfigured (config saved above has enabled:false)
    await expectError(() => extractSession(principal, session.id), "NOT_CONFIGURED", "extraction is honestly refused while no real provider is enabled — never fabricates rows");
    const failedSession = await db.bundiImportSession.findUniqueOrThrow({ where: { id: session.id } });
    assert(failedSession.status === "FAILED", "session flips to FAILED status after the honest extraction refusal");
    assert(!!failedSession.errorMessage && /not configured|not switched on/i.test(failedSession.errorMessage), "session records a real, honest error message (not a silent failure)");

    // 7) Review/commit correctly refuse a session that never reached REVIEW
    await expectError(() => reviewSession(principal, session.id, { rows: [] }), "STATE", "reviewing a non-REVIEW-status session is rejected");
    await expectError(() => commitSession(principal, session.id, { seedRequirements: true, skipInvalid: true }), "STATE", "committing a non-REVIEW-status session is rejected");

    // 8) Simulate a successful extraction directly at the DB layer (the ONLY
    // thing standing between here and a real provider call is the actual
    // HTTP request in runProviderExtraction — proven as a real, isolated,
    // swappable seam by the NOT_CONFIGURED test above). This proves the
    // REST of the pipeline — review, commit, real Student rows, real
    // StudentCustomField rows via the "custom" mapping — is completely real.
    await withTenant(principal.tenantId, () => db.bundiImportSession.update({
      where: { id: session.id },
      data: {
        status: "REVIEW",
        provider: "OPENAI_VISION_TEST_SIMULATED",
        model: "gpt-4o",
        promptTokens: 1200,
        outputTokens: 300,
        costUsd: 0.05,
        costKes: 0.05 * 145,
        extractedRowsJson: JSON.stringify([{ cells: { "Jina (Name)": { value: "Wanjiku Grace Njeri", source: "MANUAL" as const }, "Jinsia": { value: "F", source: "MANUAL" as const }, "Nyumba": { value: "Kilimanjaro", source: "MANUAL" as const } } }]),
        reviewedRowsJson: JSON.stringify([{ cells: { "Jina (Name)": { value: "Wanjiku Grace Njeri", source: "MANUAL" as const }, "Jinsia": { value: "F", source: "MANUAL" as const }, "Nyumba": { value: "Kilimanjaro", source: "MANUAL" as const } } }]),
      },
    }));

    const reviewed = await reviewSession(principal, session.id, {
      rows: [{ cells: { "Jina (Name)": { value: "Wanjiku Grace Njeri", source: "MANUAL" as const }, "Jinsia": { value: "F", source: "MANUAL" as const }, "Nyumba": { value: "Kilimanjaro", source: "MANUAL" as const } } }],
    });
    assert(reviewed.status === "REVIEW", "review save keeps the session in REVIEW status");

    const commitResult = await commitSession(principal, session.id, { seedRequirements: false, skipInvalid: true });
    assert(commitResult.created === 1, "commit creates exactly 1 real student through the STANDARD commitImport() engine");

    const committedStudent = await withTenant(principal.tenantId, () => db.student.findFirstOrThrow({ where: { firstName: "Wanjiku", lastName: "Njeri", deletedAt: null }, orderBy: { createdAt: "desc" } }));
    createdStudentIds.push(committedStudent.id);
    assert(committedStudent.gender === "F", "the committed student's real DB row has the correctly-mapped gender");

    const customFieldRow = await withTenant(principal.tenantId, () => db.studentCustomField.findFirstOrThrow({ where: { studentId: committedStudent.id, label: "House" } }));
    assert(customFieldRow.value === "Kilimanjaro", "the school-described 'custom' mapped column created a real StudentCustomField row (House=Kilimanjaro)");

    const finalSession = await db.bundiImportSession.findUniqueOrThrow({ where: { id: session.id } });
    assert(finalSession.status === "COMMITTED" && !!finalSession.studentImportId, "session flips to COMMITTED and links to the real StudentImport history row");

    const importHistoryRow = await withTenant(principal.tenantId, () => db.studentImport.findUniqueOrThrow({ where: { id: finalSession.studentImportId! } }));
    assert(importHistoryRow.source === "paste" && importHistoryRow.createdRows === 1, "the real StudentImport history row (same table the standard engine writes) reflects this Bundi-sourced commit");

    // 9) Usage dashboard reflects real aggregates
    const usage = await bundiUsageDashboard();
    assert(usage.totalSessions >= 1, "usage dashboard counts at least our real test session");
    assert(usage.totalCostKes >= 0.05 * 145 - 0.01, "usage dashboard's total cost includes our real simulated cost");
    assert(usage.topSchools.some((s) => s.tenantName === "Karibu High School"), "usage dashboard's top-schools list includes the real school by name");

    // 10) Cancel rules
    const cancelTestCode = await mintUnlockCode({ tenantId: principal.tenantId, maxUses: 5, note: "cancel test" }, admin);
    createdCodeIds.push(cancelTestCode.id);
    const cancelFile = await withTenant(principal.tenantId, () => db.storedFile.create({
      data: {
        tenantId: principal.tenantId, key: `tenants/${principal.tenantId}/bundi_import/cancel-test.jpg`,
        url: "https://example.invalid/cancel-test.jpg", fileName: "cancel-test.jpg", contentType: "image/jpeg",
        size: 100, category: "bundi_import", uploadedById: principal.id,
      },
    }));
    const cancelSessionRow = await startImportSession(principal, { domain: "STUDENT", unlockCode: cancelTestCode.code, storedFileId: cancelFile.id, fileName: "cancel-test.jpg", pageCount: 1 });
    createdSessionIds.push(cancelSessionRow.id);
    const cancelled = await cancelSession(principal, cancelSessionRow.id);
    assert(cancelled.ok, "a not-yet-committed session can be cancelled");
    await expectError(() => cancelSession(principal, session.id), "STATE", "a COMMITTED session cannot be cancelled");

    console.log("\n\u2705 M.5 Bundi handwritten import test passed");
  } finally {
    await withTenant(principal.tenantId, async () => {
      if (createdStudentIds.length) {
        await db.studentCustomField.deleteMany({ where: { studentId: { in: createdStudentIds } } });
        await db.student.deleteMany({ where: { id: { in: createdStudentIds } } });
      }
      const sessions = await db.bundiImportSession.findMany({ where: { id: { in: createdSessionIds } } });
      const importIds = sessions.map((s) => s.studentImportId).filter((x): x is string => Boolean(x));
      if (importIds.length) await db.studentImport.deleteMany({ where: { id: { in: importIds } } });
      if (createdSessionIds.length) await db.bundiImportSession.deleteMany({ where: { id: { in: createdSessionIds } } });
      await db.storedFile.deleteMany({ where: { category: "bundi_import", uploadedById: principal.id } });
      await db.bundiFieldTemplate.deleteMany({ where: { tenantId: principal.tenantId } });
    });
    if (createdCodeIds.length) await db.bundiImportUnlockCode.deleteMany({ where: { id: { in: createdCodeIds } } });
    // Reset the provider config back to the honest OFF default so this test
    // never leaves NEYO Ops looking "configured" when it isn't really.
    await db.platformSetting.deleteMany({ where: { key: "neyo_bundi_provider_config" } });
    console.log("  cleanup \u2713 (test codes, sessions, files, students, template, config removed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
