import { db } from "@/lib/db";
import { intercomBoard, startIntercomCall, decideIntercomCall } from "@/lib/services/intercom.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}
async function main() {
  console.log("I.69/I.95 intercom call signalling test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const deputyRaw = await db.user.findFirstOrThrow({ where: { email: "deputy@karibuhigh.ac.ke" } });
  const teacherRaw = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const parentRaw = await db.user.findFirstOrThrow({ where: { email: "parent@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const deputy = asUser(deputyRaw);
  const teacher = asUser(teacherRaw);
  const parent = asUser(parentRaw);

  await db.intercomCall.deleteMany({ where: { tenantId: principal.tenantId } });
  await db.session.deleteMany({ where: { token: { startsWith: "intercom-test-" } } });
  for (const u of [principal, deputy, teacher, parent]) {
    await db.session.create({ data: { token: `intercom-test-${u.id}-${Date.now()}`, userId: u.id, expiresAt: new Date(Date.now() + 3600_000) } });
  }

  const board = await intercomBoard(principal);
  assert(board.directory.some((u) => u.id === deputy.id && u.online), "directory shows target online from real active sessions");
  assert(board.directory.some((u) => u.id === parent.id && u.role === "PARENT"), "principal can see linked parent contacts");

  const parentBoard = await intercomBoard(parent);
  assert(parentBoard.directory.some((u) => u.id === teacher.id), "parent can see their child's teacher contacts");
  const parentToTeacher = await startIntercomCall(parent, teacher.id);
  assert(parentToTeacher.status === "RINGING", "parent can ring teacher directly");
  await decideIntercomCall(teacher, parentToTeacher.id, "decline");

  const call = await startIntercomCall(principal, deputy.id);
  assert(call.status === "RINGING", "call starts in RINGING state and does not count as connected");

  const queued = await startIntercomCall(teacher, deputy.id);
  assert(queued.status === "QUEUED", "second caller is queued when target is busy");

  const deputyBoard = await intercomBoard(deputy);
  assert(deputyBoard.activeCalls.some((c) => c.id === call.id && c.status === "RINGING"), "target sees incoming ringing call");

  const accepted = await decideIntercomCall(deputy, call.id, "accept");
  assert(accepted.status === "ACCEPTED" && Boolean(accepted.acceptedAt), "target acceptance moves call to ACCEPTED with acceptedAt");

  const ended = await decideIntercomCall(principal, call.id, "end");
  assert(ended.status === "ENDED" && Boolean(ended.endedAt), "caller can end accepted call");

  const queuedAfterEnd = await db.intercomCall.findUniqueOrThrow({ where: { id: queued.id } });
  assert(queuedAfterEnd.status === "MISSED", "queued caller is released/notified after active call ends");

  await db.intercomCall.deleteMany({ where: { tenantId: principal.tenantId } });
  await db.session.deleteMany({ where: { token: { startsWith: "intercom-test-" } } });
  console.log("\n✅ I.69/I.95 intercom call signalling test passed");
}
main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
