import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { generateDigitalIdentitySnapshot, initiateTransferPassport, redeemTransferPassport, getOutgoingTransfers } from "@/lib/services/digital-identity.service";

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const teacher = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" }, include: { schoolClass: true } });

  const principalUser = {
    id: principal.id,
    tenantId: tenant.id,
    neyoLoginId: principal.neyoLoginId,
    fullName: principal.fullName,
    phone: principal.phone,
    email: principal.email,
    role: principal.role,
    secondaryRole: principal.secondaryRole,
    language: principal.language,
  };

  const receivingTenant = await db.tenant.upsert({
    where: { slug: "j14-receiving-school" },
    update: { name: "J14 Receiving School" },
    create: { name: "J14 Receiving School", slug: "j14-receiving-school", county: "Nairobi" },
  });
  const receivingUserRow = await db.user.upsert({
    where: { neyoLoginId: "J14R1" },
    update: { tenantId: receivingTenant.id, role: "PRINCIPAL", fullName: "Receiving Principal", email: "receiving.principal+j14@neyo.co.ke" },
    create: {
      tenantId: receivingTenant.id,
      neyoLoginId: "J14R1",
      fullName: "Receiving Principal",
      phone: "+254700123456",
      email: "receiving.principal+j14@neyo.co.ke",
      role: "PRINCIPAL",
      passwordHash: "seed",
    },
  });
  const receivingUser = {
    id: receivingUserRow.id,
    tenantId: receivingTenant.id,
    neyoLoginId: receivingUserRow.neyoLoginId,
    fullName: receivingUserRow.fullName,
    phone: receivingUserRow.phone,
    email: receivingUserRow.email,
    role: receivingUserRow.role,
    secondaryRole: receivingUserRow.secondaryRole,
    language: receivingUserRow.language,
  };

  await db.competencyEvidence.create({
    data: {
      tenantId: tenant.id,
      competencyId: (await db.competency.findFirstOrThrow({ where: { tenantId: tenant.id } })).id,
      studentId: student.id,
      sourceModule: "MANUAL",
      evidenceDate: "2026-06-29",
      recordedById: teacher.id,
      recordedByName: teacher.fullName,
      level: 2,
      narrative: "Unapproved evidence should never leave the school.",
      approved: false,
      visibleToParents: true,
    },
  });

  await db.disciplineIncident.create({
    data: {
      tenantId: tenant.id,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNo: student.admissionNo,
      date: "2026-06-27",
      category: "LATENESS",
      severity: "MINOR",
      points: 1,
      description: "Late arrival for test coverage.",
      reportedById: teacher.id,
      reportedByName: teacher.fullName,
      status: "APPROVED",
    },
  });

  const snapshot = await generateDigitalIdentitySnapshot(principalUser as any, student.id, ["COMPETENCY", "DISCIPLINE", "ATTENDANCE"]);
  assert.ok(Array.isArray(snapshot.competencies));
  assert.equal(snapshot.competencies.some((row: any) => row.approved === false), false, "unapproved competency evidence leaked");
  assert.equal(snapshot.discipline.some((row: any) => row.status === "APPROVED"), true, "approved discipline should be included");
  assert.equal(snapshot.profile.className, `${student.schoolClass?.level} ${student.schoolClass?.stream}`.trim());

  const request = await initiateTransferPassport(principalUser as any, {
    studentId: student.id,
    destinationTenantId: receivingTenant.id,
    destinationEmail: null,
    includedModules: ["ACADEMIC", "ATTENDANCE", "DISCIPLINE", "PORTFOLIO", "MEDICAL", "TALENT", "COMPETENCY"],
    consentBy: "Otieno Brian",
  });
  assert.equal(request.status, "PENDING");
  assert.ok(request.accessCode.length >= 10, "secure code should be longer than weak 8-digit random slice");

  const list = await getOutgoingTransfers(principalUser as any, student.id);
  assert.ok(list.some((row: any) => row.id === request.id), "outgoing transfer list should include generated request");

  const redeemed = await redeemTransferPassport(receivingUser as any, { accessCode: request.accessCode });
  assert.equal(redeemed.request.status, "COMPLETED");
  assert.equal(redeemed.request.destinationTenantId, receivingTenant.id);
  assert.ok(redeemed.request.importedAt, "import timestamp missing");
  assert.equal(redeemed.request.receivedById, receivingUser.id);
  assert.equal(redeemed.snapshot.profile.fullName.includes("Achieng"), true);

  const refreshed = await db.transferPassportRequest.findUniqueOrThrow({ where: { id: request.id } });
  assert.equal(refreshed.status, "COMPLETED");
  assert.ok(refreshed.lastAccessedAt);

  const auditRows = await db.auditLog.findMany({ where: { entityType: "TransferPassportRequest", entityId: request.id }, orderBy: { createdAt: "asc" } });
  const actions = auditRows.map((row) => row.action);
  assert.ok(actions.includes("compliance.transfer_passport_generated"), "generate audit missing");
  assert.ok(actions.includes("compliance.transfer_passport_redeemed"), "redeem audit missing");
  assert.ok(actions.includes("compliance.transfer_passport_imported"), "receiving-school audit missing");

  const routeText = await import("node:fs/promises").then((fs) => fs.readFile("src/app/api/students/passport/route.ts", "utf8"));
  assert.ok(routeText.includes('requirePermission("student.view")'));
  assert.ok(routeText.includes('requirePermission("student.edit")'));
  assert.ok(!routeText.includes('students.view'));
  assert.ok(!routeText.includes('students.manage'));

  const uiText = await import("node:fs/promises").then((fs) => fs.readFile("src/components/students/student-identity-tab.tsx", "utf8"));
  assert.ok(uiText.includes("Portable learner identity view"), "identity view not mounted in UI");
  assert.ok(uiText.includes("Redeem received passport"), "receiving-school import workflow UI missing");
  assert.ok(!uiText.includes('variant="outline"'));
  assert.ok(!uiText.includes('<Badge variant='));

  console.log("✅ J.14 full-stack transfer passport test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
