/** B.1 bulk import — service-level live test. */
import { db } from "../src/lib/db";
import { parseDelimited, autoMapColumns, previewImport, commitImport } from "../src/lib/services/student-import.service";
import type { SessionUser } from "../src/lib/core/session";

const CSV = `Name,Adm No,Class,Sex,D.O.B,Parent Name,Parent Phone
Brian Odhiambo Ouma,,Form 2 East,M,14/03/2010,Grace Ouma,0721111222
Cynthia Wairimu Njeri,,Grade 4 Blue,F,2015-06-02,Peter Njeri,0733444555
Kevin Otieno,,Form 2 East,Male,01/01/2010,Grace Ouma,0721111222
BadRow OnlyOneWordGender,,Form 9 Z,X,not-a-date,Bad Phone,12345
Faith Chepkoech Rotich,,Grade 4 Blue,F,2015-09-21,Joan Rotich,0710222333`;

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const rows = parseDelimited(CSV);
  console.log("parsed rows:", rows.length, "| header:", rows[0].join("|"));
  const mapping = autoMapColumns(rows[0]);
  console.log("auto-map:", mapping.map(m => m.field).join(", "));

  const preview = await previewImport(principal, rows, true, undefined);
  console.log("preview:", JSON.stringify({ total: preview.totalRows, valid: preview.validRows, invalid: preview.invalidRows, unknownClasses: preview.unknownClasses, dupInFile: preview.duplicateInFileRows, possibleExisting: preview.possibleExistingRows }));
  console.log("first issue:", preview.issues[0]);

  const result = await commitImport(principal, { source: "csv", fileName: "test.csv", rows, hasHeader: true, mapping: preview.mapping, seedRequirements: true, skipInvalid: true });
  console.log("commit:", JSON.stringify({ created: result.created, failedCount: result.failed.length }));

  // verify: created students, shared guardian (siblings), class auto-created, requirements seeded
  const brian = await db.student.findFirst({ where: { firstName: "Brian", lastName: "Ouma" }, include: { schoolClass: true, guardians: { include: { guardian: true } }, requirements: true } });
  console.log("Brian:", brian?.admissionNo, "| class:", brian?.schoolClass?.level, brian?.schoolClass?.stream, "| guardian:", brian?.guardians[0]?.guardian.phone, "| reqs:", brian?.requirements.length);
  const kevin = await db.student.findFirst({ where: { firstName: "Kevin", lastName: "Otieno" }, include: { guardians: { include: { guardian: true } } } });
  console.log("Kevin shares guardian w/ Brian (same phone, reused row):", kevin?.guardians[0]?.guardianId === brian?.guardians[0]?.guardianId ? "✓" : "✗");
  const blue = await db.schoolClass.findFirst({ where: { level: "Grade 4", stream: "Blue" } });
  console.log("class 'Grade 4 Blue' auto-created:", blue ? "✓" : "✗");
  const hist = await db.studentImport.findFirst({ orderBy: { createdAt: "desc" } });
  console.log("history row:", hist?.source, hist?.totalRows, "->", hist?.createdRows, "created,", hist?.failedRows, "failed");
  const audit = await db.auditLog.findFirst({ where: { action: "student.bulk_import" } });
  console.log("audit student.bulk_import:", audit ? "✓" : "✗");

  // cleanup test data
  const testIds = (await db.student.findMany({ where: { OR: [{ lastName: "Ouma" }, { lastName: "Njeri", firstName: "Cynthia" }, { lastName: "Otieno", firstName: "Kevin" }, { lastName: "Rotich" }] }, select: { id: true } })).map(s => s.id);
  await db.studentRequirement.deleteMany({ where: { studentId: { in: testIds } } });
  await db.studentGuardian.deleteMany({ where: { studentId: { in: testIds } } });
  await db.student.deleteMany({ where: { id: { in: testIds } } });
  await db.guardian.deleteMany({ where: { phone: { in: ["+254721111222", "+254733444555", "+254710222333"] } } });
  if (blue) { await db.student.updateMany({ where: { classId: blue.id }, data: { classId: null } }); await db.schoolClass.delete({ where: { id: blue.id } }); }
  await db.studentImport.deleteMany({ where: { fileName: "test.csv" } });
  console.log("cleanup ✓ (test rows removed; audit row kept — immutable)");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
