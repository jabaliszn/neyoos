/** B.22 Security — live tests (service-level). */
import { db } from "../src/lib/db";
import {
  issueGatePass, useGatePass, cancelGatePass, listGatePasses,
  addPickupPerson, removePickupPerson, pickupListFor,
  raisePanic, resolvePanic,
} from "../src/lib/services/security.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  await db.gatePass.deleteMany({ where: { tenantId: t.id } });
  await db.pickupPerson.deleteMany({ where: { tenantId: t.id } });
  await db.panicAlert.deleteMany({ where: { tenantId: t.id } });
  await db.usageCounter.updateMany({ where: { tenantId: t.id, metric: "smsPerTerm" }, data: { used: 1240 } });

  const receptionist = await asUser("frontoffice@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke");
  const achieng = await db.student.findFirstOrThrow({ where: { tenantId: t.id, firstName: "Achieng" } });
  const now = new Date().toISOString();

  // 1) gate pass: issue -> GP1; dup active blocked
  const pass = await issueGatePass(receptionist, { studentId: achieng.id, reason: "Dental appointment", leaveAt: now, escortName: "Otieno Brian" });
  console.log("gate pass:", pass.passNo === "GP1" ? "✓ GP1 issued" : "✗ " + pass.passNo);
  try { await issueGatePass(receptionist, { studentId: achieng.id, reason: "Second", leaveAt: now }); console.log("dup pass: ALLOWED ✗"); }
  catch { console.log("dup active pass blocked: ✓"); }

  // 2) gate checks the pass -> USED; re-use rejected
  const used = await useGatePass(receptionist, "gp1"); // case-insensitive
  console.log("pass check at gate:", used.status === "USED" && used.usedAt ? "✓ used + stamped" : "✗");
  try { await useGatePass(receptionist, "GP1"); console.log("re-use: ALLOWED ✗"); }
  catch (e) { console.log("re-use rejected: ✓", (e as Error).message.slice(0, 40)); }
  try { await useGatePass(receptionist, "GP9999"); console.log("unknown pass: ALLOWED ✗"); }
  catch { console.log("unknown pass 404: ✓"); }

  // 3) cancel: only ACTIVE
  const p2 = await issueGatePass(receptionist, { studentId: achieng.id, reason: "Clinic run", leaveAt: now });
  await cancelGatePass(receptionist, p2.id);
  try { await cancelGatePass(receptionist, p2.id); console.log("double cancel: ALLOWED ✗"); }
  catch { console.log("double cancel blocked: ✓"); }
  const passes = await listGatePasses(receptionist);
  console.log("pass list:", passes.length === 2 ? "✓ 2 (USED + CANCELLED)" : "✗");

  // 4) pickup auth: add 2, lookup by name, remove 1
  await addPickupPerson(receptionist, { studentId: achieng.id, fullName: "Otieno Brian", relationship: "Father", phone: "+254712223344", nationalId: "12345678" });
  const aunt = await addPickupPerson(receptionist, { studentId: achieng.id, fullName: "Akinyi Rose", relationship: "Aunt", phone: "+254733112233" });
  let lookup = await pickupListFor(receptionist, "Achieng");
  console.log("pickup lookup:", lookup[0]?.persons.length === 2 ? "✓ 2 authorised (father + aunt)" : "✗");
  await removePickupPerson(receptionist, aunt.id);
  lookup = await pickupListFor(receptionist, "KHS1");
  console.log("remove person:", lookup[0]?.persons.length === 1 && lookup[0].persons[0].fullName.includes("Otieno") ? "✓ aunt removed, father stays" : "✗");

  // 5) PANIC: teacher raises -> staff in-app + leadership SMS + quota
  const before = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  const notifBefore = await db.notification.count({ where: { tenantId: t.id, category: "emergency" } });
  const panic = await raisePanic(chebet, { kind: "FIRE", location: "Science lab block" });
  const after = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  const notifAfter = await db.notification.count({ where: { tenantId: t.id, category: "emergency" } });
  console.log("panic staff alerts:", panic.notified >= 8 && notifAfter - notifBefore === panic.notified ? `✓ ${panic.notified} staff in-app` : "✗ " + JSON.stringify(panic));
  console.log("panic leadership SMS:", panic.smsSent >= 2 && (after?.used ?? 0) === (before?.used ?? 0) + panic.smsSent ? `✓ ${panic.smsSent} SMS (principal+deputy) + quota` : "✗");

  // parents/students NOT alerted
  const parentU = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const parentNotif = await db.notification.findFirst({ where: { tenantId: t.id, recipientId: parentU.id, category: "emergency" } });
  console.log("parents not panicked:", !parentNotif ? "✓ staff-only" : "✗ LEAK");

  // 6) resolve + double resolve
  await resolvePanic(receptionist, panic.id);
  try { await resolvePanic(receptionist, panic.id); console.log("double resolve: ALLOWED ✗"); }
  catch { console.log("double resolve blocked: ✓"); }

  // cleanup
  await db.gatePass.deleteMany({ where: { tenantId: t.id } });
  await db.pickupPerson.deleteMany({ where: { tenantId: t.id } });
  await db.panicAlert.deleteMany({ where: { tenantId: t.id } });
  await db.notification.deleteMany({ where: { tenantId: t.id, category: "emergency" } });
  console.log("cleanup ✓");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
