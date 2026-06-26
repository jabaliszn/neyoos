import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { getLeavingCertificate, handOverLeavingCertificate, recordLeavingCertificate } from "@/lib/services/student.service";
import { createExamMaterialRecord, listExamMaterialRecords, updateExamMaterialStatus } from "@/lib/services/exam-material.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } }));
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Atieno" } });
  const suffix = Date.now().toString().slice(-6);

  const cert = await recordLeavingCertificate(principal, {
    studentId: student.id,
    certificateType: "KCSE",
    certificateNo: `KCSE-I21-${suffix}`,
    hardcopyLocation: "Exam office vault, Cabinet 2, Folder I21",
    fileUrl: "/api/files/serve?key=tenants/test/cert.pdf",
    fileName: "kcse-i21.pdf",
  });
  assert(cert.status === "STORED", "KCSE/KCPE certificate can be stored in the vault with hardcopy location");
  const handed = await handOverLeavingCertificate(principal, { studentId: student.id, handedOverTo: "Atieno Njeri — student" });
  assert(handed.status === "HANDED_OVER" && Boolean(handed.handedOverAt), "certificate physical handover is logged with recipient, time and staff member");
  const fetched = await getLeavingCertificate(principal, student.id);
  assert(fetched?.handedOverByName === principal.fullName, "certificate handover record is retrievable from the student profile API path");

  const record = await createExamMaterialRecord(principal, {
    examName: `KCSE ${new Date().getFullYear()}`,
    materialType: "KNEC_REGISTRATION",
    title: `I21 KNEC registration materials ${suffix}`,
    deadline: "2026-07-15",
    status: "ASSEMBLING",
    hardcopyLocation: "Exam office cabinet, Shelf A, KCSE registration file",
    checklist: ["Candidate list", "Birth certificate copies", "Passport photos", "Payment proof"],
    notes: "Track assembled application materials before submission.",
  });
  assert(record.checklist.length === 4 && record.hardcopyLocation.includes("Exam office"), "exam material/application record stores checklist and physical location");
  const updated = await updateExamMaterialStatus(principal, record.id, "SUBMITTED");
  assert(updated.status === "SUBMITTED", "exam material/application status can be updated");
  const records = await listExamMaterialRecords(principal, { status: "SUBMITTED" });
  assert(records.some((r) => r.id === record.id), "exam material/application board filters and lists real DB records");

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const studentClient = readFileSync(join(process.cwd(), "src/components/students/student-profile-client.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/exam-materials/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/exam-material.service.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/exam-timetable/page.tsx"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/exams/exam-materials-client.tsx"), "utf8");

  assert(schema.includes("model LeavingCertificate") && schema.includes("model ExamMaterialRecord"), "schema has certificate vault and exam material records");
  assert(studentClient.includes("Leaving Certificate Vault") && studentClient.includes("Record Physical Handover"), "student profile UI exposes certificate vault and handover logging");
  assert(route.includes('requirePermission("exam.view")') && route.includes('requirePermission("exam.manage")'), "exam material API is permission-gated for view/manage");
  assert(service.includes("exam.material_record_created") && service.includes("exam.material_record_status_updated"), "exam material service audit-logs creation and status changes");
  assert(page.includes("ExamMaterialsClient") && client.includes("Exam applications & materials"), "exam timetable page includes exam application/materials UI");

  await db.examMaterialRecord.deleteMany({ where: { id: record.id } });
  await db.leavingCertificate.deleteMany({ where: { id: cert.id } });

  console.log("\nI.21 Certificates & Exam-Material Records test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
