import { db } from "@/lib/db";
import { createSyllabusTopic, syllabusBoard, updateSyllabusTopic } from "@/lib/services/syllabus.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`  ✓ ${message}`); }

async function main() {
  console.log("I.97 syllabus coverage test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  const subject = await db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, archived: false } });
  const term = await db.academicTerm.findFirst({ where: { tenantId: principal.tenantId, current: true } });

  const topic = await createSyllabusTopic(principal, {
    classId: cls.id,
    subjectId: subject.id,
    termId: term?.id,
    topic: `Test coverage ${Date.now()}`,
    scopeRef: "KLB Ch. 1",
    deadline: "2099-10-10",
    notes: "For testing",
  });
  assert(Boolean(topic.id), "syllabus topic is created");

  const board1 = await syllabusBoard(principal, { classId: cls.id, subjectId: subject.id });
  assert(board1.topics.some((t) => t.id === topic.id), "syllabus board lists created topic");
  assert(board1.summary.total >= 1, "syllabus board returns summary totals");

  const updated = await updateSyllabusTopic(principal, { id: topic.id, status: "COVERED" });
  assert(updated.status === "COVERED" && Boolean(updated.coveredAt), "marking covered sets status and coveredAt");

  const board2 = await syllabusBoard(principal, { classId: cls.id, subjectId: subject.id });
  assert(board2.summary.covered >= 1 && board2.summary.coveragePct >= 1, "coverage summary reflects covered topic");

  await db.syllabusTopic.delete({ where: { id: topic.id } });
  console.log("\n✅ I.97 syllabus coverage test passed");
}
main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
