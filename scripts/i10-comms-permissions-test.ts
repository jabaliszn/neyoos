import { db } from "@/lib/db";
import { bulkSend, decideTeacherMessageApproval, requestTeacherMessageApproval } from "@/lib/services/comms.service";
import { createConversation } from "@/lib/services/messaging.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function asSessionUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: (u.secondaryRole as Role | null) ?? null,
    language: u.language ?? "en",
  };
}

async function expectThrows(fn: () => Promise<unknown>, includes: string, label: string) {
  try {
    await fn();
  } catch (err) {
    assert(err instanceof Error && err.message.includes(includes), label);
    return;
  }
  throw new Error(`Expected error: ${label}`);
}

async function main() {
  console.log("I.10 communication permission test");

  const teacherRaw = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const parentRaw = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: teacherRaw.tenantId, level: "Form 2" } });

  const teacher = asSessionUser(teacherRaw);
  const principal = asSessionUser(principalRaw);
  const parent = asSessionUser(parentRaw);

  await expectThrows(
    () => bulkSend(teacher, { audienceType: "CLASS_GUARDIANS", classId: cls.id, channel: "sms", body: "Please check homework bags today.", dryRun: true }),
    "Teachers cannot send SMS",
    "teacher SMS is blocked even at preview"
  );

  const preview = await bulkSend(teacher, { audienceType: "CLASS_GUARDIANS", classId: cls.id, channel: "in_app", body: "Please check homework bags today.", dryRun: true });
  assert(preview.dryRun === true && preview.recipientCount >= 1, "teacher can preview own-class in-app recipients");

  await expectThrows(
    () => bulkSend(teacher, { audienceType: "CLASS_GUARDIANS", classId: cls.id, channel: "in_app", body: "Please check homework bags today." }),
    "approval",
    "teacher cannot send in-app class broadcast without approval"
  );

  const req = await requestTeacherMessageApproval(teacher, { classId: cls.id, channel: "in_app", body: "Please check homework bags today." });
  assert(req.status === "PENDING", "teacher approval request is created as pending");

  const approved = await decideTeacherMessageApproval(principal, { requestId: req.id, action: "approve_teacher_message" });
  assert(approved.status === "APPROVED" && (approved.sent ?? 0) >= 1, "principal approval sends the teacher in-app message");

  await expectThrows(
    () => createConversation(parent.tenantId, { id: parent.id, fullName: parent.fullName, role: parent.role, secondaryRole: parent.secondaryRole }, { type: "ANNOUNCEMENT", title: "Parents broadcast", participantIds: [teacher.id] }),
    "one-to-one",
    "parent cannot create announcements or broadcasts"
  );

  await expectThrows(
    () => createConversation(parent.tenantId, { id: parent.id, fullName: parent.fullName, role: parent.role, secondaryRole: parent.secondaryRole }, { type: "GROUP", title: "Parent group", participantIds: [teacher.id, principal.id] }),
    "one-to-one",
    "parent cannot create arbitrary group chats"
  );

  console.log("\n✅ I.10 communication permissions test passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
