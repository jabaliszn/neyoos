/** B.1 transfer management — live test. */
import { db } from "../src/lib/db";
import { transferStudent, undoTransfer, getStudent, listStudents } from "../src/lib/services/student.service";
import { buildTransferLetterPdf, verifyDocument } from "../src/lib/services/document.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const all = await listStudents(principal, {});
  const target = all.find(s => s.name.includes("Kiprono"))!;
  const before = await getStudent(principal, target.id);
  const beforeClassId = before.schoolClass?.id ?? null;
  console.log("target:", target.name, target.admissionNo, "class:", before.schoolClass?.level, before.schoolClass?.stream);

  // 1) transfer
  const { transferId } = await transferStudent(principal, target.id, {
    destinationSchool: "Moi Forces Academy", destinationCounty: "Nakuru",
    transferDate: "2026-06-15", reason: "relocation", reasonNote: "Family moved to Nakuru",
  });
  const after = await getStudent(principal, target.id);
  console.log("status TRANSFERRED:", after.status === "TRANSFERRED" ? "✓" : "✗ FAIL");
  console.log("seat freed (classId null):", after.schoolClass === null ? "✓" : "✗ FAIL");
  console.log("transfer row visible on profile:", (after as any).transfers?.length === 1 ? "✓" : "✗ FAIL");

  // 2) duplicate transfer blocked
  try { await transferStudent(principal, target.id, { destinationSchool: "X School", transferDate: "2026-06-16", reason: "other" }); console.log("duplicate transfer: ALLOWED ✗"); }
  catch { console.log("duplicate transfer blocked: ✓"); }

  // 3) letter PDF + QR verify + idempotent code
  const letter1 = await buildTransferLetterPdf(principal.tenantId, target.id, principal.fullName);
  console.log("letter PDF:", letter1.pdf.subarray(0, 4).toString() === "%PDF" ? "✓ " + letter1.fileName : "✗ FAIL");
  const t = await db.studentTransfer.findUniqueOrThrow({ where: { id: transferId } });
  const v = await verifyDocument(t.letterCode!);
  console.log("QR verify:", v?.valid && v.docType === "transfer_letter" ? "✓ " + v.summary : "✗ FAIL");
  await buildTransferLetterPdf(principal.tenantId, target.id, principal.fullName);
  const t2 = await db.studentTransfer.findUniqueOrThrow({ where: { id: transferId } });
  console.log("verify code idempotent on re-download:", t.letterCode === t2.letterCode ? "✓" : "✗ FAIL");

  // 4) audit
  const audit = await db.auditLog.findFirst({ where: { action: "student.transfer", entityId: target.id } });
  console.log("audit student.transfer:", audit ? "✓" : "✗ FAIL");

  // 5) undo restores seat
  const undo = await undoTransfer(principal, target.id);
  const restored = await getStudent(principal, target.id);
  console.log("undo -> ACTIVE:", restored.status === "ACTIVE" ? "✓" : "✗ FAIL");
  console.log("class seat restored:", restored.schoolClass?.id === beforeClassId ? "✓ " + restored.schoolClass?.level + " " + (restored.schoolClass?.stream ?? "") : "✗ FAIL");
  console.log("undo audit:", (await db.auditLog.findFirst({ where: { action: "student.transfer_undone" } })) ? "✓" : "✗ FAIL");
  void undo;

  // 6) no-transfer undo blocked
  try { await undoTransfer(principal, target.id); console.log("second undo: ALLOWED ✗"); }
  catch { console.log("undo without active transfer blocked: ✓"); }

  // cleanup history row so seed stays deterministic (audit kept — immutable)
  await db.studentTransfer.deleteMany({ where: { studentId: target.id } });
  console.log("cleanup ✓");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
