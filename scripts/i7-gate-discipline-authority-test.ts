import { db } from "../src/lib/db";
import type { Role } from "../src/lib/core/roles";
import type { SessionUser } from "../src/lib/core/session";
import { issueGatePass, useGatePass, decideGatePass } from "../src/lib/services/security.service";
import { approveIncident, approveSuspension, issueSuspension, reportIncident } from "../src/lib/services/discipline.service";
import { effectivePermissionsForUser } from "../src/lib/core/session";
import { readFileSync } from "node:fs";

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function expectThrows(name: string, fn: () => Promise<unknown>, code?: string) {
  try { await fn(); check(name, false, "expected an error"); }
  catch (e: any) { check(name, code ? e?.code === code : true, `blocked with ${e?.code ?? e?.name ?? "error"}`); }
}
function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: (u.secondaryRole ?? null) as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Karibu tenant missing. Run npm run db:seed first.");
  const [principalRow, deputyRow, receptionistRow, hodRow] = await Promise.all([
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "deputy@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "frontoffice@karibuhigh.ac.ke" } }),
    db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "f.chebet@karibuhigh.ac.ke" } }),
  ]);
  const originalHodRole = hodRow.role;
  const originalHodSecondary = hodRow.secondaryRole;
  const principal = asUser(principalRow);
  const deputy = asUser(deputyRow);
  const receptionist = asUser(receptionistRow);
  let hod = asUser(hodRow);
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE", classId: { not: null } } });
  const createdGateIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdSuspensionIds: string[] = [];
  const testDate = "2026-06-23";

  try {
    await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });
    hod = asUser(await db.user.findUniqueOrThrow({ where: { id: hodRow.id } }));
    const hodPerms = await effectivePermissionsForUser(hod);
    check("HOD can open Security and Discipline for proposal workflows", hodPerms.includes("security.view") && hodPerms.includes("discipline.manage"));

    await expectThrows(
      "Security/receptionist cannot issue gate passes",
      () => issueGatePass(receptionist, { studentId: student.id, reason: "I.7 receptionist negative", leaveAt: `${testDate}T10:00:00.000Z` }),
      "FORBIDDEN"
    );

    const pendingPass = await issueGatePass(hod, { studentId: student.id, reason: "HOD proposed clinic follow-up", leaveAt: `${testDate}T10:00:00.000Z`, escortName: "Auntie Njeri" });
    createdGateIds.push(pendingPass.id);
    check("HOD-issued gate pass is pending approval", pendingPass.status === "PENDING");
    await expectThrows("Gate cannot use a pending pass", () => useGatePass(receptionist, pendingPass.passNo), "ALREADY");
    await expectThrows("HOD cannot approve their own gate pass", () => decideGatePass(hod, pendingPass.id, true), "FORBIDDEN");
    const approvedPass = await decideGatePass(principal, pendingPass.id, true, "Approved after parent call");
    check("Principal approves HOD gate pass", approvedPass.status === "ACTIVE" && approvedPass.approvedByName === principal.fullName);
    const used = await useGatePass(receptionist, pendingPass.passNo);
    check("Security only confirms/uses approved gate pass by number", used.status === "USED" && !!used.usedAt);

    const directPass = await issueGatePass(deputy, { studentId: student.id, reason: "Deputy approved hospital pass", leaveAt: `${testDate}T12:00:00.000Z` });
    createdGateIds.push(directPass.id);
    check("Deputy-issued gate pass is active immediately", directPass.status === "ACTIVE" && directPass.approvedByName === deputy.fullName);

    const pendingIncident = await reportIncident(hod, { studentId: student.id, date: testDate, category: "BULLYING", severity: "MAJOR", description: "Reported by HOD for approval test", actionTaken: "Parent follow-up proposed" });
    createdIncidentIds.push(pendingIncident.id);
    check("HOD major discipline case is pending approval", pendingIncident.status === "PENDING" && pendingIncident.parentNotified === false);
    await expectThrows("HOD cannot approve discipline case", () => approveIncident(hod, pendingIncident.id, true), "FORBIDDEN");
    const approvedIncident = await approveIncident(deputy, pendingIncident.id, true, "Deputy reviewed");
    check("Deputy approves discipline case", approvedIncident.status === "APPROVED" && approvedIncident.approvedByName === deputy.fullName);

    const pendingSuspension = await issueSuspension(hod, { studentId: student.id, startDate: testDate, endDate: "2026-06-24", reason: "Repeated bullying after warning", conditions: "Return with parent" });
    createdSuspensionIds.push(pendingSuspension.id);
    check("HOD suspension is pending approval", pendingSuspension.status === "PENDING");
    await expectThrows("HOD cannot approve suspension", () => approveSuspension(hod, pendingSuspension.id), "FORBIDDEN");
    const activeSuspension = await approveSuspension(principal, pendingSuspension.id);
    check("Principal approves suspension", activeSuspension.status === "ACTIVE");

    await expectThrows("Ordinary teacher cannot propose suspension", async () => {
      const teacher = asUser(await db.user.update({ where: { id: hodRow.id }, data: { role: "TEACHER", secondaryRole: null } }));
      await issueSuspension(teacher, { studentId: student.id, startDate: "2026-06-25", endDate: "2026-06-26", reason: "Teacher should be blocked" });
    }, "FORBIDDEN");

    const gateUi = readFileSync("src/components/security/gate-client.tsx", "utf8");
    check("Gate UI separates issue/propose from gate confirmation", gateUi.includes("canIssuePass") && gateUi.includes("Check a pass at the gate") && gateUi.includes("pending approval"));
    const disciplineUi = readFileSync("src/components/discipline/discipline-client.tsx", "utf8");
    check("Discipline UI has pending approval actions", disciplineUi.includes("Approve case") && disciplineUi.includes("Issue / propose suspension"));
  } finally {
    await db.gatePass.deleteMany({ where: { id: { in: createdGateIds } } });
    await db.disciplineIncident.deleteMany({ where: { id: { in: createdIncidentIds } } });
    await db.suspension.deleteMany({ where: { id: { in: createdSuspensionIds } } });
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalHodRole, secondaryRole: originalHodSecondary } });
    await db.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nI.7 gate & discipline authority: ${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
