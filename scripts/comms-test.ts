/** B.14 Communication — live tests (service-level). */
import { db } from "../src/lib/db";
import { bulkSend, audienceOptions, listBulkMessages } from "../src/lib/services/comms.service";
import { getUsage } from "../src/lib/services/limits.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const chebet = await asUser("f.chebet@karibuhigh.ac.ke"); // CLASS_TEACHER — class-only comms
  const njoroge = await asUser("p.njoroge@karibuhigh.ac.ke"); // TEACHER, no class
  const t = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 2", stream: "East" } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { tenantId: t.id, level: "Form 1", stream: "West" } });

  // 1) audience options: principal full; chebet class-scoped; njoroge empty (fail-closed)
  const pOpts = await audienceOptions(principal);
  console.log("principal audiences:", !pOpts.teacherScoped && pOpts.schoolFamilies === 5 && pOpts.classes.length === 2 && pOpts.roles.length > 0
    ? `✓ school=5 families, ${pOpts.classes.length} classes, ${pOpts.roles.length} roles` : "✗ " + JSON.stringify({ s: pOpts.schoolFamilies, c: pOpts.classes.length }));
  const cOpts = await audienceOptions(chebet);
  console.log("chebet audiences:", cOpts.teacherScoped && cOpts.classes.length === 1 && cOpts.roles.length === 0 ? "✓ own class only, no roles" : "✗");
  const nOpts = await audienceOptions(njoroge);
  console.log("njoroge audiences:", nOpts.teacherScoped && nOpts.classes.length === 0 ? "✓ fail-closed (0 classes)" : "✗");

  // 2) DRY RUN school-wide SMS: 5 families (one per guardian phone — dedupe check)
  const dry = await bulkSend(principal, { audienceType: "SCHOOL_GUARDIANS", channel: "sms", body: "Dry run message for testing.", dryRun: true });
  console.log("dry run:", dry.dryRun && dry.recipientCount === 5 && (dry as { allowed?: boolean }).allowed ? `✓ 5 families, cost KES ${dry.costKes}` : "✗ " + JSON.stringify(dry));

  // 3) REAL send class SMS + quota usage recorded
  const usageBefore = await getUsage(t.id, "smsPerTerm");
  const sendRes = await bulkSend(principal, { audienceType: "CLASS_GUARDIANS", classId: f2e.id, channel: "sms", body: "Form 2 East: bring KLB Bk 3 tomorrow for the Mathematics lesson." });
  const usageAfter = await getUsage(t.id, "smsPerTerm");
  const sentN = ("sent" in sendRes ? sendRes.sent : -1) ?? -1;
  const skippedN = ("skipped" in sendRes ? sendRes.skipped : -1) ?? -1;
  console.log("class send:", !sendRes.dryRun && sentN === 3 && skippedN === 0 ? "✓ 3 families (F2E)" : "✗ " + JSON.stringify(sendRes));
  console.log("quota recorded:", usageAfter === usageBefore + 3 ? `✓ ${usageBefore} -> ${usageAfter}` : `✗ ${usageBefore} -> ${usageAfter}`);

  // 4) ledger row written
  const ledger = await listBulkMessages(principal);
  console.log("ledger:", ledger[0]?.audienceLabel.includes("Form 2 East") && ledger[0]?.sentCount === 3 ? "✓ newest row = F2E send" : "✗");

  // 5) in-app to a role -> dispatcher creates inbox rows
  const inAppRes = await bulkSend(principal, { audienceType: "ROLE", role: "TEACHER", channel: "in_app", body: "Staff briefing 7am Monday in the staff room." });
  const inAppSent = ("sent" in inAppRes ? inAppRes.sent : 0) ?? 0;
  const njorogeNotif = await db.notification.findFirst({
    where: { tenantId: t.id, recipientId: njoroge.id, category: "announcement" },
    orderBy: { createdAt: "desc" },
  });
  console.log("role in-app:", inAppSent >= 1 && njorogeNotif ? `✓ ${inAppSent} teacher(s), inbox row created` : "✗ " + JSON.stringify({ sent: inAppSent, found: !!njorogeNotif }));

  // 6) teacher restrictions: chebet OK to own class, blocked elsewhere
  const cSend = await bulkSend(chebet, { audienceType: "CLASS_GUARDIANS", classId: f2e.id, channel: "sms", body: "Homework reminder: insha due Monday.", dryRun: true });
  console.log("chebet own class:", cSend.recipientCount === 3 ? "✓ allowed (3 families)" : "✗");
  try { await bulkSend(chebet, { audienceType: "SCHOOL_GUARDIANS", channel: "sms", body: "should fail school-wide" }); console.log("chebet school-wide: ALLOWED ✗"); }
  catch { console.log("chebet school-wide blocked: ✓"); }
  try { await bulkSend(chebet, { audienceType: "CLASS_GUARDIANS", classId: f1w.id, channel: "sms", body: "should fail other class" }); console.log("chebet other class: ALLOWED ✗"); }
  catch { console.log("chebet other class blocked: ✓"); }
  try { await bulkSend(chebet, { audienceType: "ROLE", role: "TEACHER", channel: "in_app", body: "should fail role" }); console.log("chebet role send: ALLOWED ✗"); }
  catch { console.log("chebet role send blocked: ✓"); }

  // 7) QUOTA BLOCK: push usage to the hard cap -> dry run says blocked, real send throws
  const cap = await db.usageCounter.findFirst({ where: { tenantId: t.id, metric: "smsPerTerm" }, orderBy: { periodKey: "desc" } });
  const original = cap?.used ?? 0;
  await db.usageCounter.updateMany({ where: { tenantId: t.id, metric: "smsPerTerm" }, data: { used: 99999 } });
  const blockedDry = await bulkSend(principal, { audienceType: "SCHOOL_GUARDIANS", channel: "sms", body: "Should be blocked by quota.", dryRun: true });
  console.log("quota dry-run blocks:", (blockedDry as { allowed?: boolean }).allowed === false ? "✓ " + (blockedDry as { message?: string }).message?.slice(0, 40) : "✗");
  try { await bulkSend(principal, { audienceType: "SCHOOL_GUARDIANS", channel: "sms", body: "Should throw." }); console.log("quota real send: ALLOWED ✗"); }
  catch (e) { console.log("quota real send blocked: ✓", (e as Error).message.slice(0, 40)); }
  await db.usageCounter.updateMany({ where: { tenantId: t.id, metric: "smsPerTerm" }, data: { used: original } });

  // cleanup: remove test ledger rows + notifications (keep the seeded broadcast)
  await db.bulkMessage.deleteMany({ where: { tenantId: t.id, id: { not: undefined }, body: { contains: "KLB Bk 3 tomorrow" } } });
  await db.bulkMessage.deleteMany({ where: { tenantId: t.id, body: { contains: "Staff briefing" } } });
  await db.notification.deleteMany({ where: { tenantId: t.id, body: { contains: "Staff briefing" } } });
  console.log("cleanup ✓ (usage restored to", original, ")");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
