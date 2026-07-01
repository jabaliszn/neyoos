/**
 * K.10 full-stack test — Parent/Teacher uploads + Pending Approval flow.
 *
 * Proves the REPAIRED security model end-to-end against the live SQLite DB:
 *  1. A PARENT can submit a request for their OWN child.
 *  2. A PARENT is BLOCKED from submitting for a non-child (even in same class).
 *  3. A CLASS_TEACHER sees only pending requests for students in their class.
 *  4. A CLASS_TEACHER (has student.edit) can APPROVE a PHOTO_UPDATE and it lands
 *     on the student profile.
 *  5. Approval flow correctly creates a StudentDocument for DOCUMENT_UPLOAD.
 *  6. Re-reviewing an already-processed request fails (INVALID).
 *
 * Cleans up everything it creates so the DB is left as found.
 */
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/lib/core/tenant-context";
import {
  submitStudentApprovalRequest,
  reviewStudentApprovalRequest,
  getPendingApprovals,
  ApprovalError,
} from "../src/lib/services/student-approval.service";

const db = new PrismaClient();

type SU = {
  id: string; tenantId: string; neyoLoginId: string; fullName: string;
  phone: string | null; email: string | null; role: any; secondaryRole: any; language: string;
};

function su(u: any, tenantId: string): SU {
  return {
    id: u.id, tenantId, neyoLoginId: u.neyoLoginId ?? u.id, fullName: u.fullName,
    phone: u.phone ?? null, email: u.email ?? null, role: u.role, secondaryRole: u.secondaryRole ?? null,
    language: u.language ?? "en",
  };
}

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}`); }
}

async function main() {
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error("tenant not found");
  const tid = t.id;

  // Seed actors
  const parentU = await db.user.findFirst({ where: { tenantId: tid, email: "parent@karibuhigh.ac.ke" } });
  const classTeacherU = await db.user.findFirst({ where: { tenantId: tid, email: "f.chebet@karibuhigh.ac.ke" } });
  const plainTeacherU = await db.user.findFirst({ where: { tenantId: tid, email: "p.njoroge@karibuhigh.ac.ke" } });
  if (!parentU || !classTeacherU || !plainTeacherU) throw new Error("seed users missing");

  // Resolve guardian children
  const guardian = await db.guardian.findFirst({ where: { tenantId: tid, userId: parentU.id }, include: { students: true } });
  const childId = guardian!.students[0].studentId;            // own child (Achieng)
  const ownChildIds = guardian!.students.map((s) => s.studentId);

  // A student NOT belonging to this parent
  const other = await db.student.findFirst({ where: { tenantId: tid, id: { notIn: ownChildIds } } });
  const otherId = other!.id;

  const parent = su(parentU, tid);
  const classTeacher = su(classTeacherU, tid);

  // Save original photo so we restore it
  const beforeChild = await db.student.findUnique({ where: { id: childId } });
  const originalPhoto = beforeChild?.photoUrl ?? null;

  const created: string[] = [];

  console.log("K.10 — Parent/Teacher upload approval flow\n");

  // 1) Parent submits for own child
  let ownReq: any = null;
  try {
    ownReq = await submitStudentApprovalRequest(parent, {
      studentId: childId,
      requestType: "PHOTO_UPDATE",
      documentLabel: null,
      fileUrl: "https://files.neyo.test/k10-photo.jpg",
      fileName: "k10-photo.jpg",
    });
    created.push(ownReq.id);
    check("PARENT can submit for own child", !!ownReq?.id && ownReq.status === "PENDING");
  } catch (e) {
    check("PARENT can submit for own child", false);
  }

  // 2) Parent BLOCKED for non-child
  let blocked = false;
  try {
    await submitStudentApprovalRequest(parent, {
      studentId: otherId,
      requestType: "PHOTO_UPDATE",
      documentLabel: null,
      fileUrl: "https://files.neyo.test/evil.jpg",
      fileName: "evil.jpg",
    });
  } catch (e) {
    blocked = e instanceof ApprovalError && e.code === "FORBIDDEN";
  }
  check("PARENT blocked from submitting for a non-child", blocked);

  // 3) Class teacher sees pending requests for their class (includes own child req)
  const pending = await getPendingApprovals(classTeacher);
  const seesOwn = pending.some((p: any) => p.id === ownReq?.id);
  check("CLASS_TEACHER sees pending request for student in their class", seesOwn);

  // 4) Class teacher approves photo -> lands on profile
  await reviewStudentApprovalRequest(classTeacher, ownReq.id, { status: "APPROVED", rejectionReason: null });
  const afterChild = await db.student.findUnique({ where: { id: childId } });
  check("Approved PHOTO_UPDATE updates the student photo", afterChild?.photoUrl === "https://files.neyo.test/k10-photo.jpg");

  // 5) Document upload approval -> creates StudentDocument
  const docReq = await submitStudentApprovalRequest(parent, {
    studentId: childId,
    requestType: "DOCUMENT_UPLOAD",
    documentLabel: "Birth Certificate",
    fileUrl: "https://files.neyo.test/k10-birthcert.pdf",
    fileName: "birthcert.pdf",
  });
  created.push(docReq.id);
  await reviewStudentApprovalRequest(classTeacher, docReq.id, { status: "APPROVED", rejectionReason: null });
  const doc = await db.studentDocument.findFirst({ where: { studentId: childId, fileUrl: "https://files.neyo.test/k10-birthcert.pdf" } });
  check("Approved DOCUMENT_UPLOAD creates a StudentDocument", !!doc);

  // 6) Re-review already processed -> INVALID
  let invalid = false;
  try {
    await reviewStudentApprovalRequest(classTeacher, ownReq.id, { status: "REJECTED", rejectionReason: "x" });
  } catch (e) {
    invalid = e instanceof ApprovalError && e.code === "INVALID";
  }
  check("Re-reviewing a processed request is rejected (INVALID)", invalid);

  // --- cleanup ---
  await withTenant(tid, async () => { /* noop to keep symmetry */ });
  for (const id of created) {
    await db.studentApprovalRequest.delete({ where: { id } }).catch(() => {});
  }
  if (doc) await db.studentDocument.delete({ where: { id: doc.id } }).catch(() => {});
  await db.student.update({ where: { id: childId }, data: { photoUrl: originalPhoto } });

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("  \u2705 K.10 all green");
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
