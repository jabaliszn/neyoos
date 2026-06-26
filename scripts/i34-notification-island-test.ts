import { db } from "@/lib/db";
import { createInApp, listForUser, markRead } from "@/lib/services/notification.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.34/I.96 notification island data test");
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const teacher = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });

  const n = await createInApp({
    tenantId: principal.tenantId,
    recipientId: principal.id,
    title: "Message delivery report ready",
    body: "3 read · 2 confirmed received · 1 not read",
    category: "message",
    href: "/messages?open=test-thread",
  });

  const principalInbox = await listForUser(principal.id, 10);
  assert(principalInbox.items.some((x) => x.id === n.id && x.href === "/messages?open=test-thread"), "targeted principal notification includes deep link");
  assert(principalInbox.unread >= 1, "targeted principal notification increments unread count");

  const teacherInbox = await listForUser(teacher.id, 50);
  assert(!teacherInbox.items.some((x) => x.id === n.id), "other users do not receive someone else's targeted notification");

  await markRead(principal.id, n.id);
  const after = await listForUser(principal.id, 10);
  const read = after.items.find((x) => x.id === n.id);
  assert(Boolean(read?.readAt), "mark-read works for notification panel/deep-link click");

  await db.notification.delete({ where: { id: n.id } }).catch(() => {});
  console.log("\n✅ I.34/I.96 notification island data test passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());
