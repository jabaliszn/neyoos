import { db } from "@/lib/db";
import {
  acknowledgeMessage,
  createConversation,
  getMessages,
  sendMessage,
  sendUnreadMessageFallbacks,
  generateDueMessageDeliveryReports,
  messageDeliveryReport,
} from "@/lib/services/messaging.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.70/I.85 message receipts + acknowledgement test");

  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const bursar = await db.user.findFirstOrThrow({ where: { email: "bursar@karibuhigh.ac.ke" } });
  const teacher = await db.user.findFirstOrThrow({ where: { email: "p.njoroge@karibuhigh.ac.ke" } });

  const convo = await createConversation(
    principal.tenantId,
    { id: principal.id, fullName: principal.fullName, role: principal.role as any, secondaryRole: principal.secondaryRole as any },
    { type: "DIRECT", participantIds: [bursar.id] }
  );

  const msg = await sendMessage(
    principal.tenantId,
    { id: principal.id, fullName: principal.fullName },
    {
      conversationId: convo.id,
      body: "Please confirm the M-Pesa reconciliation file was received.",
      requiresAck: true,
      urgentAfterHours: 24,
    }
  );
  assert(Boolean(msg.requiresAck), "message stores explicit acknowledgement requirement");
  assert(Boolean(msg.urgentFallbackAt), "message stores urgent fallback deadline");

  await getMessages(principal.tenantId, bursar.id, convo.id, { markRead: true });
  const principalView = await getMessages(principal.tenantId, principal.id, convo.id, { markRead: false });
  const seen = principalView.messages.find((m) => m.id === msg.id)?.readBy ?? [];
  assert(seen.some((r) => r.userId === bursar.id && r.name === bursar.fullName && r.readAt), "sender sees who read the message and when");

  await acknowledgeMessage(principal.tenantId, { id: bursar.id, fullName: bursar.fullName }, { conversationId: convo.id, messageId: msg.id });
  const withAck = await getMessages(principal.tenantId, principal.id, convo.id, { markRead: false });
  const ackBy = withAck.messages.find((m) => m.id === msg.id)?.ackBy ?? [];
  assert(ackBy.some((a) => a.userId === bursar.id && a.acknowledgedAt), "sender sees who tapped I received this and when");


  await db.message.update({ where: { id: msg.id }, data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
  const generatedReports = await generateDueMessageDeliveryReports();
  assert(generatedReports.generated >= 1, "24-hour delivery report job generates due reports");
  const reportRes = await messageDeliveryReport(principal.tenantId, principal.id, { conversationId: convo.id, messageId: msg.id });
  assert(reportRes.pending === false && Boolean(reportRes.report) && reportRes.report!.readCount >= 1 && reportRes.report!.ackCount >= 1, "sender can open the 24-hour delivery report with read and acknowledgement counts");

  const fallbackConvo = await createConversation(
    principal.tenantId,
    { id: principal.id, fullName: principal.fullName, role: principal.role as any, secondaryRole: principal.secondaryRole as any },
    { type: "DIRECT", participantIds: [teacher.id] }
  );
  const fallbackMsg = await sendMessage(
    principal.tenantId,
    { id: principal.id, fullName: principal.fullName },
    {
      conversationId: fallbackConvo.id,
      body: "Urgent staff briefing moved to 4pm. Please read immediately.",
      requiresAck: true,
      urgentAfterHours: 6,
    }
  );
  await db.message.update({ where: { id: fallbackMsg.id }, data: { urgentFallbackAt: new Date(Date.now() - 60_000), fallbackSmsSentAt: null } });
  const summary = await sendUnreadMessageFallbacks();
  const afterFallback = await db.message.findUniqueOrThrow({ where: { id: fallbackMsg.id } });
  assert(summary.messagesChecked >= 1, "fallback job checks due urgent messages");
  assert(Boolean(afterFallback.fallbackSmsSentAt), "fallback job marks message after SMS fallback attempt");

  console.log("\n✅ I.70/I.85 message receipts test passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
