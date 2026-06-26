import { db } from "../src/lib/db";
import { createStudent, addGuardian, addDocument, getStudent, listStudents } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId } });
  const res = await createStudent(principal, {
    firstName: "Wafula", lastName: "Simiyu", gender: "M",
    dateOfBirth: "2011-03-14", classId: cls.id, status: "ACTIVE",
    seedRequirements: true,
  } as any);
  const id = (res as any).id ?? (res as any).student?.id;
  const created = await getStudent(principal, id);
  console.log("created:", created.admissionNo, "| neyoLoginId:", (created as any).neyoLoginId ?? "(check)", "| reqs seeded:", created.requirements?.length ?? 0);
  await addGuardian(principal, id, { fullName: "Nekesa Simiyu", phone: "0722334455", relationship: "Mother", isPrimary: true, createLogin: false } as any);
  const withG = await getStudent(principal, id);
  console.log("guardian added:", withG.guardians?.length === 1 ? "✓ " + (withG.guardians[0] as any).guardian?.phone : "✗");
  await addDocument(principal, id, { label: "Birth certificate", fileUrl: "/api/files/serve?k=test", fileName: "birth.pdf", hardcopyLocation: "Audit shelf" });
  const withD = await getStudent(principal, id);
  console.log("document added:", withD.documents?.length === 1 ? "✓" : "✗");
  // search by adm no
  const byAdm = await listStudents(principal, { q: created.admissionNo });
  console.log("search by admissionNo:", byAdm.length === 1 ? "✓" : "✗");
  // cleanup (hard delete test student)
  await db.studentRequirement.deleteMany({ where: { studentId: id } });
  await db.studentDocument.deleteMany({ where: { studentId: id } });
  await db.studentGuardian.deleteMany({ where: { studentId: id } });
  await db.student.delete({ where: { id } });
  console.log("cleanup done");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
