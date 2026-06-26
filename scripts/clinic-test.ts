/** B.21 Clinic — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  upsertMedicalProfile, medicalFile, allergyRegister, recordVisit, listVisits,
  startMedication, giveDose, stopMedication, activeMedications, healthReport, childHealth,
} from "../src/lib/services/clinic.service";
import { kitchenToday } from "../src/lib/services/cafeteria.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  // Self-heal: reset clinic tables + quota, reseed.
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.medicationDose.deleteMany({ where: { tenantId: t.id } });
  await db.medicationPlan.deleteMany({ where: { tenantId: t.id } });
  await db.clinicVisit.deleteMany({ where: { tenantId: t.id } });
  await db.studentMedical.deleteMany({ where: { tenantId: t.id } });
  await db.usageCounter.updateMany({ where: { tenantId: t.id, metric: "smsPerTerm" }, data: { used: 1240 } });
  const { execSync } = await import("child_process");
  execSync("npm run db:seed", { cwd: process.cwd(), stdio: "pipe" });

  const deputy = await asUser("deputy@karibuhigh.ac.ke"); // acts as nurse-capable leadership
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const atieno = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Atieno" } });
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

  // 1) seeded profile + allergy register
  const reg = await allergyRegister(deputy);
  console.log("allergy register:", reg.length === 1 && reg[0].allergies.includes("Penicillin") ? "✓ Atieno: Penicillin + Groundnuts" : "✗");

  // 2) medical file
  const file = await medicalFile(deputy, atieno.id);
  console.log("medical file:", file.profile.bloodGroup === "O+" && file.visits.length === 1 && file.plans.length === 1 ? "✓ profile + visit + plan" : "✗");

  // 3) ALLERGY ALERT on a visit: Penicillin given to Atieno -> warning returned
  const v = await recordVisit(deputy, {
    studentId: atieno.id, date: today, complaint: "Sore throat", treatment: "Examined",
    medicationGiven: "Penicillin V 250mg",
  });
  console.log("allergy warning on visit:", v.allergyWarning?.includes("ALLERGIC to Penicillin") ? "✓ " + v.allergyWarning : "✗ " + v.allergyWarning);

  // 4) allergy guard BLOCKS a medication plan
  try {
    await startMedication(deputy, { studentId: atieno.id, drug: "Penicillin V", dosage: "1 tab", frequency: "2x daily", startDate: today });
    console.log("allergy plan guard: ALLOWED ✗ DANGER");
  } catch (e) { console.log("allergy plan guard: ✓", (e as Error).message.slice(0, 50)); }

  // 5) REFERRAL -> guardian SMS + quota
  const before = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  const ref = await recordVisit(deputy, {
    studentId: achieng.id, date: today, complaint: "High fever 39.5°C", treatment: "First aid; cold compress",
    referredTo: "Kiambu Level 5 Hospital",
  });
  const after = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  console.log("referral SMS:", ref.parentNotified && (after?.used ?? 0) === (before?.used ?? 0) + 1 ? "✓ guardian SMS + quota +1" : "✗");

  // 6) medication: start -> dose -> trail -> stop -> double-stop
  const plan = await startMedication(deputy, { studentId: achieng.id, drug: "Paracetamol 500mg", dosage: "1 tablet", frequency: "3x daily", startDate: today });
  await giveDose(deputy, plan.id, "After lunch");
  const meds = await activeMedications(deputy);
  const planRow = meds.find((m) => m.id === plan.id)!;
  console.log("dose trail:", planRow.lastDoseAt && planRow.lastDoseBy ? "✓ last dose recorded w/ giver" : "✗");
  try { await giveDose(deputy, "nonexistent"); console.log("bad plan: ALLOWED ✗"); } catch { console.log("bad plan 404: ✓"); }
  await stopMedication(deputy, plan.id);
  try { await stopMedication(deputy, plan.id); console.log("double stop: ALLOWED ✗"); } catch { console.log("double stop blocked: ✓"); }
  try { await giveDose(deputy, plan.id); console.log("dose on stopped: ALLOWED ✗"); } catch { console.log("dose on stopped plan blocked: ✓"); }

  // 7) health report
  const report = await healthReport(deputy);
  console.log("health report:", report.totalVisits >= 3 && report.referrals === 1 && report.allergicStudents === 1
    ? `✓ ${report.totalVisits} visits, 1 referral, 1 allergic` : "✗ " + JSON.stringify(report));

  // 8) kitchen board shows food allergies (B.19 link)
  const bursar = await asUser("bursar@karibuhigh.ac.ke");
  const kitchen = await kitchenToday(bursar);
  console.log("kitchen allergy board:", kitchen.foodAllergies.some((a) => a.allergies.includes("Groundnuts")) ? "✓ Groundnuts flagged for the cooks" : "✗");

  // 9) family portal: own child only; visits visible, profile allergies visible (parents SHOULD know)
  const ch = await childHealth(parent, achieng.id);
  console.log("parent sees child visits:", ch.visits.length >= 1 && ch.visits.some((x) => x.referredTo) ? "✓ incl. referral" : "✗");
  try { await childHealth(parent, atieno.id); console.log("other family: ALLOWED ✗ LEAK"); }
  catch { console.log("other-family health blocked: ✓"); }

  // 10) profile upsert (no dup) — update Atieno's allergies
  await upsertMedicalProfile(deputy, { studentId: atieno.id, allergies: ["Penicillin", "Groundnuts", "Bee stings"] });
  const reg2 = await allergyRegister(deputy);
  console.log("profile upsert:", reg2[0].allergies.length === 3 && reg2.length === 1 ? "✓ updated in place" : "✗");

  // cleanup extras (keep seed shape)
  await db.clinicVisit.deleteMany({ where: { tenantId: t.id, date: today } });
  await db.medicationDose.deleteMany({ where: { planId: plan.id } });
  await db.medicationPlan.delete({ where: { id: plan.id } });
  await upsertMedicalProfile(deputy, { studentId: atieno.id, allergies: ["Penicillin", "Groundnuts"] });
  const visits = await listVisits(deputy);
  console.log("cleanup ✓ (", visits.length, "seed visit left )");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
