import { db } from "@/lib/db";
import { joinMealQueue, queueBoard, serveMealQueue, cancelMealQueue } from "@/lib/services/cafeteria.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}
async function expectThrows(fn: () => Promise<unknown>, label: string) {
  try { await fn(); } catch { console.log(`  ✓ ${label}`); return; }
  throw new Error(`Expected failure: ${label}`);
}

async function main() {
  console.log("I.31/I.19 cafeteria queue test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const students = await db.student.findMany({ where: { tenantId: principal.tenantId, status: "ACTIVE", deletedAt: null }, take: 2 });
  assert(students.length >= 2, "seed has students for queue test");
  const date = "2099-09-09";
  await db.cafeteriaQueueEntry.deleteMany({ where: { tenantId: principal.tenantId, date } });

  const q1 = await joinMealQueue(principal, { studentId: students[0].id, session: "LUNCH", date });
  const q2 = await joinMealQueue(principal, { studentId: students[1].id, session: "LUNCH", date });
  assert(q1.queueNo === 1 && q2.queueNo === 2, "meal queue assigns sequential queue numbers");

  await expectThrows(() => joinMealQueue(principal, { studentId: students[0].id, session: "LUNCH", date }), "duplicate queue join is denied");
  const served = await serveMealQueue(principal, q1.id);
  assert(served.status === "SERVED" && Boolean(served.servedAt), "serving marks queue entry served with timestamp");
  const cancelled = await cancelMealQueue(principal, q2.id);
  assert(cancelled.status === "CANCELLED", "cancel marks waiting queue entry cancelled");

  const board = await queueBoard(principal, { session: "LUNCH", date });
  assert(board.served === 1 && board.cancelled === 1 && board.waiting === 0, "queue board counts waiting/served/cancelled");

  await db.cafeteriaQueueEntry.deleteMany({ where: { tenantId: principal.tenantId, date } });
  console.log("\n✅ I.31/I.19 cafeteria queue test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
