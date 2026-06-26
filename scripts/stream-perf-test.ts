/** B.5 inter-stream comparison — live test w/ 2 streams. */
import { db } from "../src/lib/db";
import { examSummary } from "../src/lib/services/exam.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const exam = await db.exam.findFirstOrThrow({ where: { name: { contains: "CAT 1" } }, include: { subjects: true } });
  const f1w = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 1", stream: "West" } });
  const f1wStudents = await db.student.findMany({ where: { classId: f1w.id, status: "ACTIVE" } });

  // give F1W students marks (weaker stream for contrast)
  for (const st of f1wStudents) {
    for (const sub of exam.subjects) {
      await db.examResult.upsert({
        where: { examId_studentId_subjectId: { examId: exam.id, studentId: st.id, subjectId: sub.subjectId } },
        create: { tenantId: principal.tenantId, examId: exam.id, studentId: st.id, subjectId: sub.subjectId, marks: 40 + Math.floor(Math.random() * 15), enteredById: principal.id },
        update: {},
      });
    }
  }

  const sum = await examSummary(principal, exam.id);
  console.log("streams compared:", sum.classMeans.map(c => `#${c.rank} ${c.label}: ${c.mean}% (${c.students})`).join(" | "));
  console.log("ranked correctly:", sum.classMeans[0].mean >= sum.classMeans[sum.classMeans.length-1].mean ? "✓" : "✗");
  console.log("levels:", sum.levelMeans.map(l => `${l.level}: ${l.mean}% (${l.students})`).join(" | "));
  console.log("has both Form 1 + Form 2 levels:", sum.levelMeans.length === 2 ? "✓" : "✗");

  // cleanup F1W test marks
  await db.examResult.deleteMany({ where: { examId: exam.id, studentId: { in: f1wStudents.map(s => s.id) } } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
