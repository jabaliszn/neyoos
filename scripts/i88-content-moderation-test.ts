import { db } from "@/lib/db";
import { createConversation, sendMessage } from "@/lib/services/messaging.service";
import { bulkSend } from "@/lib/services/comms.service";
import { createThread } from "@/lib/services/lms.service";
import { assertRespectfulContent, moderationResult } from "@/lib/services/content-moderation.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }
async function expectModerated(fn: () => Promise<unknown>, message: string) {
  try { await fn(); } catch (e: any) {
    if (e?.code === "CONTENT_MODERATED" || String(e?.message || "").toLowerCase().includes("moderation")) { console.log(`  ✓ ${message}`); return; }
    throw e;
  }
  throw new Error(`Expected moderation: ${message}`);
}

async function main() {
  console.log("I.88 harmful/abusive content moderation test");
  const principalDb = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const teacherDb = await db.user.findFirstOrThrow({ where: { email: "p.njoroge@karibuhigh.ac.ke" } });
  const principal = asUser(principalDb);
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });

  assert(moderationResult("Please check the fee statement").ok, "normal school communication is allowed");
  assert(!moderationResult("you are mjinga").ok, "shared moderation detects abusive Kiswahili/English language");
  try { assertRespectfulContent("Please go die", "test"); throw new Error("not moderated"); } catch (e: any) { assert(e.code === "CONTENT_MODERATED", "harmful self-harm/death phrase is blocked"); }

  const convo = await createConversation(principal.tenantId, principal, { type: "DIRECT", participantIds: [teacherDb.id] });
  await expectModerated(() => sendMessage(principal.tenantId, principal, { conversationId: convo.id, body: "You are pumbavu" }), "direct/inbox messages are blocked before saving");
  const savedBad = await db.message.findFirst({ where: { conversationId: convo.id, body: { contains: "pumbavu" } } });
  assert(!savedBad, "moderated direct message is not saved to DB");

  await expectModerated(() => bulkSend(principal, { audienceType: "role", role: "TEACHER", channel: "in_app", body: "This announcement contains asshole language", dryRun: true }), "broadcast/in-app announcements are blocked in dry-run and real send paths");

  await expectModerated(() => createThread(principal, { classId: cls.id, title: "Class reminder", body: "Do not post porn here" }), "learning forum/class discussion threads are moderated");

  const service = readFileSync("src/lib/services/content-moderation.service.ts", "utf8");
  assert(service.includes("BLOCKED_TERMS") && service.includes("assertRespectfulContent"), "shared moderation service is the single policy source");
  const messaging = readFileSync("src/lib/services/messaging.service.ts", "utf8");
  const comms = readFileSync("src/lib/services/comms.service.ts", "utf8");
  const lms = readFileSync("src/lib/services/lms.service.ts", "utf8");
  assert(messaging.includes("assertRespectfulContent(input.body") && comms.includes("assertRespectfulContent(input.body") && lms.includes("assertRespectfulContent"), "moderation is wired across messages, broadcasts and class discussions");

  await db.conversationParticipant.deleteMany({ where: { conversationId: convo.id } });
  await db.message.deleteMany({ where: { conversationId: convo.id } });
  await db.conversation.deleteMany({ where: { id: convo.id } });
  console.log("\n✅ I.88 harmful/abusive content moderation test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
