import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { createConversation } from "../src/lib/services/messaging.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const bursar = await db.user.findFirstOrThrow({ where: { email: "bursar@karibuhigh.ac.ke" } });
  const parent = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });

  const c1 = await createConversation(principal.tenantId, { id: principal.id, fullName: principal.fullName, role: principal.role as any }, {
    type: "DIRECT",
    participantIds: [bursar.id],
  });
  const c2 = await createConversation(principal.tenantId, { id: principal.id, fullName: principal.fullName, role: principal.role as any }, {
    type: "DIRECT",
    participantIds: [bursar.id],
  });
  assert(c1.id === c2.id, "quick message reuses existing 1:1 conversation and does not duplicate threads");

  const parentToPrincipal = await createConversation(parent.tenantId, { id: parent.id, fullName: parent.fullName, role: parent.role as any }, {
    type: "DIRECT",
    participantIds: [principal.id],
  });
  const participants = await db.conversationParticipant.findMany({ where: { conversationId: parentToPrincipal.id } });
  assert(participants.length === 2, "parent quick-message contact opens a real 1:1 school conversation");

  const button = readFileSync(join(process.cwd(), "src/components/messaging/message-button.tsx"), "utf8");
  const staff = readFileSync(join(process.cwd(), "src/components/hr/staff-client.tsx"), "utf8");
  const portal = readFileSync(join(process.cwd(), "src/components/portal/parent-portal-client.tsx"), "utf8");
  const studentProfile = readFileSync(join(process.cwd(), "src/components/students/student-profile-client.tsx"), "utf8");
  const messages = readFileSync(join(process.cwd(), "src/components/messaging/messages-client.tsx"), "utf8");

  assert(button.includes("/api/conversations") && button.includes("router.push(`/messages?open="), "MessageButton uses real conversation API and opens the returned thread");
  assert(staff.includes("<MessageButton recipientId={r.userId}") && staff.includes('label="Message this person"'), "staff directory and staff file drawer have inline quick-message buttons");
  assert(portal.includes("MessageButton") && !portal.includes("href={`/messages?to=${t.id}`}"), "parent portal Talk to the school uses real quick-message buttons instead of broken to-links");
  assert(studentProfile.includes('label="Message guardian"') && studentProfile.includes("g.guardian.userId"), "student profile guardians with portal accounts have Message guardian button");
  assert(messages.includes('params.get("to")') && messages.includes('body: JSON.stringify({ type: "DIRECT", participantIds: [to] })'), "Messages page still supports /messages?to=<userId> deep links by creating/reusing a direct thread");

  console.log("\nI.12 quick messaging buttons test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
