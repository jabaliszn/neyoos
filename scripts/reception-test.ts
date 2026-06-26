/** A.18 live test: walk-in payment, visitor badges, phone relay, day-end summary. */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  signInVisitor, signOutVisitor, recordWalkInPayment,
  relayPhoneMessage, dayEndSummary, ReceptionError,
} from "../src/lib/services/reception.service";

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const recept = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "RECEPTIONIST" } });
  const bursar = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "BURSAR" } });
  const actor = { id: recept.id, name: recept.fullName };

  // 1) Visitor sign-in -> badge increments past seeded V2.
  const v = await withTenant(tenant.id, () => signInVisitor(tenant.id, { name: "Test Mwende", purpose: "Delivery" }, recept.id));
  console.log(`visitor badge=${v.badgeNo} (seeded had V1,V2 -> expect V3)`);
  const out = await withTenant(tenant.id, () => signOutVisitor(v.id));
  console.log(`signed out at set: ${!!out.signedOutAt}`);

  // 2) Walk-in cash payment -> PAID with synthetic ref.
  const pay = await recordWalkInPayment(tenant.id, { amount: 3500, phone: "+254712000111", method: "cash", accountRef: "KHS999" }, actor);
  console.log(`cash payment status=${pay.status} ref=${pay.mpesaRef} provider=${pay.provider}`);

  // 3) M-Pesa dedup: same ref twice -> DUPLICATE.
  await recordWalkInPayment(tenant.id, { amount: 2000, phone: "+254712000111", method: "mpesa", mpesaRef: "TESTDUP123" }, actor);
  let dupBlocked = false;
  try {
    await recordWalkInPayment(tenant.id, { amount: 2000, phone: "+254712000111", method: "mpesa", mpesaRef: "TESTDUP123" }, actor);
  } catch (e) { dupBlocked = e instanceof ReceptionError && e.code === "DUPLICATE"; }
  console.log(`mpesa duplicate ref blocked: ${dupBlocked} (want true)`);

  // 4) Phone relay -> creates a conversation + a message lands in bursar inbox.
  const relay = await withTenant(tenant.id, () => relayPhoneMessage(tenant.id, { callerName: "Parent X", forUserId: bursar.id, message: "Call about transport" }, actor));
  const msg = await db.message.findFirst({ where: { conversationId: relay.conversationId }, orderBy: { createdAt: "desc" } });
  console.log(`relay conversation=${!!relay.conversationId}, last msg contains relay text: ${msg?.body.includes("Parent X")}`);

  // 5) Day-end summary totals.
  const sum = await dayEndSummary(tenant.id);
  console.log("day-end totals:", JSON.stringify(sum.totals));

  // cleanup test rows
  await db.payment.deleteMany({ where: { tenantId: tenant.id, mpesaRef: { in: [pay.mpesaRef!, "TESTDUP123"] } } });
  await db.visitorLog.deleteMany({ where: { tenantId: tenant.id, name: "Test Mwende" } });
  await db.phoneMessage.deleteMany({ where: { tenantId: tenant.id, callerName: "Parent X" } });
  console.log("cleaned up test rows");
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
