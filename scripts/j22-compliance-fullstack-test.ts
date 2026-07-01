/**
 * J.22 — Compliance, Consent & Data Safety — full-stack proof.
 *
 * Proves, against the REAL repo (services + DB + validation + cron registry + flags),
 * that:
 *  1. ODPC lawful-basis is ENFORCED: a transfer with no consent is rejected by the
 *     real `initiateTransferPassport` service (ComplianceError), and an invalid
 *     module set is rejected (data-minimisation).
 *  2. A lawful transfer (with consent) succeeds, records consentBy + consentDate,
 *     and writes a `compliance.transfer_passport_generated` audit log.
 *  3. The PDF export now writes a `compliance.transfer_passport_exported` audit log
 *     (was previously unlogged).
 *  4. The REAL retention engine wired into the cron purges expired passport payloads
 *     (sets payloadJson=null, status=EXPIRED) and old DRAFT portfolio items — proven
 *     by invoking the actual `data-retention` JOB handler from the registry, NOT a
 *     re-implementation.
 *  5. Part-J toggle: when J.22 is switched OFF in NEYO Ops, the transfer surface is
 *     blocked; switching ON restores it. Default is ON.
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import {
  initiateTransferPassport,
  exportTransferPassportPdf,
  DigitalIdentityError,
} from "../src/lib/services/digital-identity.service";
import {
  assertLawfulTransferBasis,
  ComplianceError,
} from "../src/lib/services/retention.service";
import { JOBS } from "../src/lib/jobs/registry";
import { setFlag, FlagError } from "../src/lib/services/platform-flags.service";
import { jFeatureKey } from "../src/lib/core/j-features";

function sessionFrom(u: any) {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as any, secondaryRole: u.secondaryRole as any, language: u.language as any,
  };
}

let pass = 0;
function check(name: string, cond: boolean) {
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ✓ ${name}`);
  pass++;
}

async function main() {
  const ops = sessionFrom(await db.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } }));
  const principal = sessionFrom(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const student = await db.student.findFirstOrThrow({ where: { firstName: "Atieno" } });

  // ---- clean leftovers from prior runs ----
  await db.transferPassportRequest.deleteMany({ where: { destinationEmail: { contains: "j22-test" } } });
  await db.portfolioItem.deleteMany({ where: { title: { startsWith: "J22 Test" } } });
  await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.22") } });
  await db.auditLog.deleteMany({ where: { action: { startsWith: "compliance.transfer_passport" }, metadata: { contains: "j22-test" } } });

  console.log("\n[1] ODPC lawful-basis is ENFORCED on the live transfer path");
  // 1a. No consent → ComplianceError FORBIDDEN (the validation schema requires consentBy,
  // but we assert the *service-level* guard directly too, since it is the enforced gate).
  let threwNoConsent = false;
  try {
    assertLawfulTransferBasis({ consentBy: "", includedModules: ["ACADEMIC"] });
  } catch (e) {
    threwNoConsent = e instanceof ComplianceError && (e as ComplianceError).code === "FORBIDDEN";
  }
  check("transfer with no consent is rejected (ODPC lawful basis)", threwNoConsent);

  // 1b. Unknown module → ComplianceError INVALID (data-minimisation)
  let threwBadModule = false;
  try {
    assertLawfulTransferBasis({ consentBy: "Owino Otieno", includedModules: ["ACADEMIC", "SOCIAL_SECURITY_NUMBER"] });
  } catch (e) {
    threwBadModule = e instanceof ComplianceError && (e as ComplianceError).code === "INVALID";
  }
  check("transfer with an unknown data module is rejected (data-minimisation)", threwBadModule);

  // 1c. service-level: initiateTransferPassport rejects empty consent too
  let serviceRejected = false;
  try {
    await initiateTransferPassport(principal, {
      studentId: student.id,
      destinationEmail: "j22-test-noconsent@nairobihigh.ac.ke",
      includedModules: ["ACADEMIC"],
      consentBy: "",
    } as any);
  } catch (e) {
    serviceRejected = e instanceof ComplianceError;
  }
  check("initiateTransferPassport itself enforces the lawful-basis guard", serviceRejected);

  console.log("\n[2] A lawful transfer succeeds + records consent + audits generation");
  const req = await initiateTransferPassport(principal, {
    studentId: student.id,
    destinationEmail: "j22-test-good@nairobihigh.ac.ke",
    includedModules: ["ACADEMIC", "MEDICAL", "DISCIPLINE"],
    consentBy: "Owino Otieno",
  } as any);
  check("transfer passport created", !!req.id);
  check("consentBy recorded", req.consentBy === "Owino Otieno");
  check("consentDate recorded (lawful basis timestamp)", req.consentDate instanceof Date);
  const genAudit = await db.auditLog.findFirst({
    where: { action: "compliance.transfer_passport_generated", entityId: req.id },
  });
  check("generation is audit-logged", !!genAudit);

  console.log("\n[3] PDF export is now audit-logged (was previously unlogged)");
  const beforeExport = await db.auditLog.count({ where: { action: "compliance.transfer_passport_exported", entityId: student.id } });
  const pdf = await exportTransferPassportPdf(principal, student.id);
  check("export returns a PDF buffer", Buffer.isBuffer(pdf) && pdf.length > 0);
  const afterExport = await db.auditLog.count({ where: { action: "compliance.transfer_passport_exported", entityId: student.id } });
  check("export wrote a compliance.transfer_passport_exported audit log", afterExport === beforeExport + 1);

  console.log("\n[4] The REAL retention engine (wired into the cron) purges expired data");
  // Seed an EXPIRED passport with a payload + an old DRAFT portfolio item.
  const expiredDate = new Date(); expiredDate.setDate(expiredDate.getDate() - 2);
  const expired = await db.transferPassportRequest.create({
    data: {
      sourceTenantId: principal.tenantId,
      destinationEmail: "j22-test-expired@nairobihigh.ac.ke",
      studentId: student.id,
      studentName: "Atieno Owino",
      accessCode: "J22EXP" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      expiresAt: expiredDate,
      status: "PENDING",
      includedModules: JSON.stringify(["ACADEMIC"]),
      consentBy: "Owino Otieno",
      consentDate: new Date(),
      payloadJson: JSON.stringify({ secret: "SHOULD BE WIPED" }),
    },
  });
  const oldDate = new Date(); oldDate.setFullYear(oldDate.getFullYear() - 2);
  const oldDraft = await db.portfolioItem.create({
    data: {
      tenantId: principal.tenantId,
      studentId: student.id,
      title: "J22 Test Stale Draft",
      category: "ACADEMIC",
      status: "DRAFT",
      visibleToParents: false,
      createdById: principal.id,
      createdByName: principal.fullName,
      createdAt: oldDate,
    } as any,
  });

  // Invoke the ACTUAL registered cron handler — not a re-implementation.
  const result: any = await JOBS["data-retention"]({ progress: async () => {} });
  check("data-retention job reported expiredPassportsPurged >= 1", result.expiredPassportsPurged >= 1);
  check("data-retention job reported oldPortfoliosPurged >= 1", result.oldPortfoliosPurged >= 1);

  const wiped = await db.transferPassportRequest.findUniqueOrThrow({ where: { id: expired.id } });
  check("expired passport payload was wiped (payloadJson=null)", wiped.payloadJson === null);
  check("expired passport status set to EXPIRED", wiped.status === "EXPIRED");
  const purgeAudit = await db.auditLog.findFirst({ where: { action: "compliance.transfer_passport_payload_purged", entityId: expired.id } });
  check("payload purge is audit-logged", !!purgeAudit);
  const stillThere = await db.portfolioItem.findUnique({ where: { id: oldDraft.id } });
  check("stale DRAFT portfolio item was purged", stillThere === null);

  console.log("\n[5] Part-J toggle: J.22 default ON; OFF blocks; ON restores");
  // default ON
  let okWhileOn = true;
  try {
    await initiateTransferPassport(principal, {
      studentId: student.id,
      destinationEmail: "j22-test-toggle-on@nairobihigh.ac.ke",
      includedModules: ["ACADEMIC"],
      consentBy: "Owino Otieno",
    } as any);
  } catch { okWhileOn = false; }
  check("J.22 defaults ON — transfer works without any flag row", okWhileOn);

  // switch OFF
  await setFlag(ops, jFeatureKey("J.22"), true, "j22-test pause");
  let blockedWhileOff = false;
  try {
    await initiateTransferPassport(principal, {
      studentId: student.id,
      destinationEmail: "j22-test-toggle-off@nairobihigh.ac.ke",
      includedModules: ["ACADEMIC"],
      consentBy: "Owino Otieno",
    } as any);
  } catch (e) {
    blockedWhileOff = e instanceof FlagError && (e as FlagError).code === "FORBIDDEN";
  }
  check("when J.22 is switched OFF, the transfer surface is blocked", blockedWhileOff);

  // switch back ON
  await setFlag(ops, jFeatureKey("J.22"), false, "j22-test release");
  let restored = true;
  try {
    await initiateTransferPassport(principal, {
      studentId: student.id,
      destinationEmail: "j22-test-toggle-restore@nairobihigh.ac.ke",
      includedModules: ["ACADEMIC"],
      consentBy: "Owino Otieno",
    } as any);
  } catch { restored = false; }
  check("switching J.22 back ON restores the transfer surface", restored);

  // ---- clean up everything this test created ----
  await db.transferPassportRequest.deleteMany({ where: { destinationEmail: { contains: "j22-test" } } });
  await db.portfolioItem.deleteMany({ where: { title: { startsWith: "J22 Test" } } });
  await db.platformFlag.deleteMany({ where: { moduleKey: jFeatureKey("J.22") } });

  console.log(`\n✅ J.22 full-stack test: ${pass} checks passed, 0 failed.`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("\n❌ J.22 full-stack test FAILED:", e);
  await db.$disconnect();
  process.exit(1);
});
