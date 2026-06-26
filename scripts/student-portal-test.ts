/** B.11 shared family portal — live tests as a STUDENT. */
import { db } from "../src/lib/db";
import { myChildren, childDetail } from "../src/lib/services/parent-portal.service";
import { studentReport } from "../src/lib/services/exam.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  // create/find Achieng's student login (createLogin pattern from B.1)
  const achieng = await db.student.findFirstOrThrow({ where: { firstName: "Achieng" } });
  let sUser = achieng.userId ? await db.user.findUnique({ where: { id: achieng.userId } }) : null;
  if (!sUser) {
    const { hash } = await import("@node-rs/argon2");
    sUser = await db.user.create({
      data: {
        tenantId: achieng.tenantId, neyoLoginId: "NEYO-STUD-0001",
        fullName: "Achieng Mary Otieno", role: "STUDENT", isActive: true,
        email: "achieng@karibuhigh.ac.ke", passwordHash: await hash("Karibu2026!"),
      },
    });
    await db.student.update({ where: { id: achieng.id }, data: { userId: sUser.id } });
    console.log("student login created: achieng@karibuhigh.ac.ke");
  } else console.log("student login exists");
  const student = sUser as unknown as SessionUser;

  // 1) student sees exactly herself in the shared portal
  const me = await myChildren(student);
  console.log("student portal cards:", me.length, me[0]?.name, me.length === 1 && me[0].id === achieng.id ? "✓ own record only" : "✗");

  // 2) detail incl TIMETABLE (the new B.11 line)
  const detail = await childDetail(student, achieng.id);
  console.log("timetable slots:", detail.timetable.length, detail.timetable.length === 8 ? "✓ (F2E seeded week)" : "✗");
  console.log("fees visible:", detail.invoices.length >= 1 ? "✓" : "✗", "| results:", detail.exams.length >= 1 ? "✓" : "✗", "| attendance:", detail.attendance.length > 0 ? "✓" : "✗");

  // 3) another student's record blocked
  const other = await db.student.findFirstOrThrow({ where: { id: { not: achieng.id }, status: "ACTIVE" } });
  try { await childDetail(student, other.id); console.log("other student: ALLOWED ✗ LEAK"); }
  catch { console.log("other student blocked: ✓"); }

  // 4) own report card allowed (published)
  const rep = await studentReport(student, detail.exams[0].examId, achieng.id);
  console.log("own report card:", rep.avgPct + "% " + rep.overallGrade, "✓");
  // another student's report blocked
  try { await studentReport(student, detail.exams[0].examId, other.id); console.log("other report: ALLOWED ✗"); }
  catch { console.log("other report blocked: ✓"); }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
