/** G.10 Document Set — Student ID Card + Transcript live tests (SELF-HEALS). */
import { db } from "../src/lib/db";
import { buildStudentIdCardPdf, buildStudentTranscriptPdf, verifyDocument } from "../src/lib/services/document.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const principal = await su("principal@karibuhigh.ac.ke");
  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, firstName: "Achieng" } });

  // 1) Build Student ID Card PDF
  const idCard = await buildStudentIdCardPdf(principal.tenantId, student.id);
  assert("ID card PDF generated successfully", idCard.pdf.subarray(0, 4).toString() === "%PDF");
  assert("ID card fileName follows standard", idCard.fileName === `ID-${student.admissionNo}.pdf`);

  // 2) Verify ID Card document
  const verifyId = await verifyDocument(idCard.code);
  assert("ID card is verified valid", verifyId?.valid === true);
  assert("ID card docType is student_id", verifyId?.docType === "student_id");
  assert("ID card summary includes student name", verifyId?.summary.includes("Achieng") ?? false);

  // 3) Build Student Transcript PDF
  const transcript = await buildStudentTranscriptPdf(principal.tenantId, student.id);
  assert("Transcript PDF generated successfully", transcript.pdf.subarray(0, 4).toString() === "%PDF");
  assert("Transcript fileName follows standard", transcript.fileName === `Transcript-${student.admissionNo}.pdf`);

  // 4) Verify Transcript document
  const verifyTrn = await verifyDocument(transcript.code);
  assert("Transcript is verified valid", verifyTrn?.valid === true);
  assert("Transcript docType is student_transcript", verifyTrn?.docType === "student_transcript");
  assert("Transcript summary includes admission number", verifyTrn?.summary.includes(student.admissionNo) ?? false);

  // Cleanup verifications from db to prevent clutter
  await db.documentVerification.deleteMany({
    where: { code: { in: [idCard.code, transcript.code] } },
  });

  console.log(`\nG.10 Document Set: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
