/** B.2 admissions — live pipeline test. */
import { db } from "../src/lib/db";
import { submitApplication, decide, convertInquiry, pipeline, buildAdmissionLetterPdf } from "../src/lib/services/admission.service";
import { verifyDocument } from "../src/lib/services/document.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const tenantId = principal.tenantId;

  // 1) online application
  const app = await submitApplication(tenantId, {
    firstName: "Neema", middleName: "", lastName: "Chepkemoi", gender: "F",
    dateOfBirth: "2012-01-15", gradeWanted: "Form 1", curriculum: "8-4-4",
    previousSchool: "Kericho Primary", guardianName: "Ruth Chepkemoi",
    guardianPhone: "0712009900", guardianEmail: "", notes: "",
  });
  console.log("applied:", app.applicationNo, app.applicationNo.startsWith("KHADM") ? "✓" : "✗");

  // 2) duplicate blocked
  try { await submitApplication(tenantId, { firstName: "Neema", middleName: "", lastName: "Chepkemoi", gender: "F", dateOfBirth: "", gradeWanted: "Form 1", guardianName: "Ruth Chepkemoi", guardianPhone: "0712009900", guardianEmail: "", previousSchool: "", notes: "" }); console.log("duplicate: ALLOWED ✗"); }
  catch { console.log("duplicate blocked: ✓"); }

  // 3) pipeline transitions + interview -> calendar event
  await decide(principal, app.id, { action: "review" } as never);
  const iv = await decide(principal, app.id, { action: "schedule_interview", interviewDate: "2026-06-20", interviewTime: "10:00" } as never);
  console.log("interview:", iv.status === "INTERVIEW" ? "✓" : "✗", "| calendar event:", iv.calendarEventId ? "✓ created" : "✗ FAIL");
  const ev = await db.calendarEvent.findUnique({ where: { id: iv.calendarEventId! } });
  console.log("  event title:", ev?.title?.includes("Neema") ? "✓" : "✗", "| type:", ev?.type);

  // 4) offer w/ deposit; admit blocked until deposit met
  await decide(principal, app.id, { action: "offer", depositRequiredKes: 5000 } as never);
  try { await decide(principal, app.id, { action: "admit" } as never); console.log("admit before deposit: ALLOWED ✗ FAIL"); }
  catch (e) { console.log("admit blocked before deposit: ✓", (e as Error).message.slice(0, 60)); }

  // 5) deposit then admit -> student created w/ guardian + requirements
  await decide(principal, app.id, { action: "record_deposit", amountKes: 5000, reference: "SFC12345" } as never);
  const cls = await db.schoolClass.findFirstOrThrow({ where: { tenantId, level: "Form 1" } });
  const admitted = await decide(principal, app.id, { action: "admit", classId: cls.id } as never);
  console.log("admitted:", admitted.status === "ADMITTED" && admitted.studentId ? "✓ student " + admitted.studentId : "✗ FAIL");
  const student = await db.student.findUnique({ where: { id: admitted.studentId! }, include: { guardians: { include: { guardian: true } }, requirements: true } });
  console.log("  student:", student?.admissionNo, "| guardian:", student?.guardians[0]?.guardian.phone === "+254712009900" ? "✓" : "✗", "| reqs:", student?.requirements.length);

  // 6) invalid transition (admit again)
  try { await decide(principal, app.id, { action: "admit" } as never); console.log("re-admit: ALLOWED ✗"); }
  catch { console.log("re-admit blocked: ✓"); }

  // 7) letter PDF + QR
  const letter = await buildAdmissionLetterPdf(tenantId, app.id, principal.fullName);
  console.log("letter PDF:", letter.pdf.subarray(0, 4).toString() === "%PDF" ? "✓ " + letter.fileName : "✗");
  const a2 = await db.admissionApplication.findUniqueOrThrow({ where: { id: app.id } });
  const v = await verifyDocument(a2.letterCode!);
  console.log("QR verify:", v?.valid && v.docType === "admission_letter" ? "✓" : "✗");

  // 8) inquiry conversion (A.18 link)
  const inq = await db.admissionInquiry.findFirst({ where: { tenantId, status: "NEW" } });
  if (inq) {
    const conv = await convertInquiry(principal, inq.id);
    const inqAfter = await db.admissionInquiry.findUnique({ where: { id: inq.id } });
    console.log("inquiry converted:", conv.applicationNo, "| inquiry status:", inqAfter?.status === "CONTACTED" ? "✓ CONTACTED" : "✗");
    await db.admissionApplication.delete({ where: { id: conv.id } });
    await db.admissionInquiry.update({ where: { id: inq.id }, data: { status: "NEW" } });
  } else console.log("inquiry conversion: (no NEW inquiry in seed?)");

  // 9) board
  const board = await pipeline(principal);
  console.log("pipeline rows:", board.length, board.length >= 4 ? "✓" : "✗");

  // cleanup test app + its student
  if (admitted.studentId) {
    await db.studentRequirement.deleteMany({ where: { studentId: admitted.studentId } });
    await db.studentGuardian.deleteMany({ where: { studentId: admitted.studentId } });
    await db.student.delete({ where: { id: admitted.studentId } });
    await db.guardian.deleteMany({ where: { phone: "+254712009900", students: { none: {} } } });
  }
  if (iv.calendarEventId) await db.calendarEvent.delete({ where: { id: iv.calendarEventId } }).catch(() => null);
  await db.admissionApplication.delete({ where: { id: app.id } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
