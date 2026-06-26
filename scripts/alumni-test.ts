/** B.1 alumni — live test. */
import { db } from "../src/lib/db";
import { updateStudent, getStudent, listAlumni, graduateClass, listStudents } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const all = await listStudents(principal, {});
  const target = all.find(s => s.name.includes("Kiprono"))!;
  const beforeS = await getStudent(principal, target.id);
  const beforeClassId = beforeS.schoolClass?.id ?? null;

  // 1) single graduate stamps year + final class label
  await updateStudent(principal, target.id, { status: "GRADUATED" });
  const grad = await db.student.findUniqueOrThrow({ where: { id: target.id } });
  const yr = new Date().getFullYear();
  console.log("graduationYear stamped:", grad.graduationYear === yr ? "✓ " + grad.graduationYear : "✗ FAIL");
  console.log("finalClassLabel kept:", grad.finalClassLabel ? "✓ " + grad.finalClassLabel : "✗ FAIL");

  // 2) alumni directory lists him, grouped year
  const dir = await listAlumni(principal);
  console.log("alumni lists him:", dir.alumni.some(a => a.id === target.id) ? "✓" : "✗ FAIL");
  console.log("year pills:", JSON.stringify(dir.years));
  const filtered = await listAlumni(principal, yr);
  console.log("year filter works:", filtered.alumni.every(a => a.graduationYear === yr) && filtered.alumni.length > 0 ? "✓" : "✗ FAIL");

  // 3) un-graduate clears alumni fields
  await updateStudent(principal, target.id, { status: "ACTIVE", classId: beforeClassId ?? undefined });
  const back = await db.student.findUniqueOrThrow({ where: { id: target.id } });
  console.log("un-graduate clears year+label:", back.graduationYear === null && back.finalClassLabel === null ? "✓" : "✗ FAIL");

  // 4) bulk graduate a whole class (use Form 2 East)
  const cls = await db.schoolClass.findFirstOrThrow({ where: { level: "Form 2", stream: "East" } });
  const beforeCount = await db.student.count({ where: { classId: cls.id, status: "ACTIVE" } });
  const result = await graduateClass(principal, cls.id, 2030);
  console.log(`bulk graduate: ${result.graduated}/${beforeCount} -> Class of ${result.year} (${result.class})`, result.graduated === beforeCount ? "✓" : "✗ FAIL");
  const empty = await db.student.count({ where: { classId: cls.id, status: "ACTIVE" } });
  console.log("class emptied:", empty === 0 ? "✓" : "✗ FAIL");
  const audit = await db.auditLog.findFirst({ where: { action: "student.class_graduated" } });
  console.log("audit class_graduated:", audit ? "✓" : "✗ FAIL");

  // 5) CLASS_TEACHER cannot graduate someone else's class
  const chebet = (await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const otherCls = await db.schoolClass.findFirstOrThrow({ where: { id: { not: cls.id } } });
  try { await graduateClass(chebet, otherCls.id); console.log("class teacher other-class graduate: ALLOWED ✗"); }
  catch { console.log("class teacher other-class graduate blocked: ✓"); }

  // restore: un-graduate the bulk batch back into Form 2 East
  await db.student.updateMany({ where: { finalClassLabel: "Form 2 East", graduationYear: 2030 }, data: { status: "ACTIVE", classId: cls.id, graduationYear: null, finalClassLabel: null } });
  const restored = await db.student.count({ where: { classId: cls.id, status: "ACTIVE" } });
  console.log("restored class:", restored === beforeCount ? "✓" : "✗ FAIL");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
