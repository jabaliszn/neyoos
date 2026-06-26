/** H.5 Quick-Action Messaging Buttons — backend path test (self-healing). */
import { db } from "../src/lib/db";
import { createConversation } from "../src/lib/services/messaging.service";

async function user(email: string) {
  return await db.user.findFirstOrThrow({ where: { email } });
}

async function main() {
  const principal = await user("principal@karibuhigh.ac.ke");
  const bursar = await user("bursar@karibuhigh.ac.ke");
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  // 1) quick-action button creates (or reuses) a DIRECT conversation
  const c1 = await createConversation(principal.tenantId, { id: principal.id, fullName: principal.fullName }, {
    type: "DIRECT", participantIds: [bursar.id],
  });
  ok(!!c1.id, "quick message → DIRECT conversation created/returned");

  // 2) verify exactly 2 participants (principal + bursar)
  const parts = await db.conversationParticipant.findMany({ where: { conversationId: c1.id } });
  ok(parts.length === 2, "conversation has exactly 2 participants (1:1)");

  // 3) clicking again reuses the SAME thread (no duplicates)
  const c2 = await createConversation(principal.tenantId, { id: principal.id, fullName: principal.fullName }, {
    type: "DIRECT", participantIds: [bursar.id],
  });
  ok(c2.id === c1.id, "repeat quick message reuses the same thread (no duplicate)");

  // 4) deep-link target is /messages?open=<id> — id is usable
  ok(typeof c1.id === "string" && c1.id.length > 0, "conversation id usable for /messages?open=<id> deep-link");

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
