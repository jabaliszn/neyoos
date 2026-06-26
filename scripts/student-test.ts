/** B.1 live test: admission-no, listing, and row-scoping (A.3.8/A.3.9). */
import { db } from "../src/lib/db";
import { listStudents, getStudent, createStudent, StudentError } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role, secondaryRole: u.secondaryRole ?? null, language: u.language };
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } }));
  const classTeacher = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "CLASS_TEACHER" } }));
  const parent = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PARENT" } }));
  const otherTeacher = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "TEACHER" } }));

  // 1) Principal sees ALL students.
  const allForPrincipal = await listStudents(principal, {});
  console.log(`PRINCIPAL sees ${allForPrincipal.length} students (expect 5)`);

  // 2) CLASS_TEACHER (Chebet Faith assigned to Form 2 East) sees only their class.
  const forClassTeacher = await listStudents(classTeacher, {});
  console.log(`CLASS_TEACHER sees ${forClassTeacher.length} (only their class — Form 2 East has 3): ${forClassTeacher.map(s=>s.name).join(", ")}`);

  // 3) A TEACHER assigned to NO class sees nothing (fail-closed).
  const forOtherTeacher = await listStudents(otherTeacher, {});
  console.log(`TEACHER (no class) sees ${forOtherTeacher.length} (expect 0 — fail-closed)`);

  // 4) PARENT sees only their own child.
  const forParent = await listStudents(parent, {});
  console.log(`PARENT sees ${forParent.length} (expect 1 — own child): ${forParent.map(s=>s.name).join(", ")}`);

  // 5) PARENT cannot open another student's profile.
  const someoneElse = allForPrincipal.find(s => !forParent.some(p => p.id === s.id))!;
  let blocked = false;
  try { await getStudent(parent, someoneElse.id); } catch (e) { blocked = e instanceof StudentError && e.code === "NOT_FOUND"; }
  console.log(`PARENT opening another child's profile blocked: ${blocked} (expect true)`);

  // 6) Admission-no generation increments.
  const created = await createStudent(principal, { firstName: "Test", lastName: "Mwende", gender: "F", seedRequirements: false } as any);
  console.log(`created student adm: ${created.admissionNo} (KHSN format)`);
  await db.student.delete({ where: { id: created.id } });
  // restore the consumed sequence so reseed stays tidy is not needed (idSequence just increments)

  await db.$disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
