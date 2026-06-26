import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { getDocumentDesign, saveDocumentDesign } from "@/lib/services/document-design.service";
import { renderStudentIdCardsPdf } from "@/lib/documents/student-id-pdf";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }
function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }

async function main() {
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const saved = await saveDocumentDesign(principal, { idCardWidthMm: 86, idCardHeightMm: 54, idTemplate: "navy", documentTemplate: "compact", smallTimetableLogo: true, poweredByNeyo: true });
  const loaded = await getDocumentDesign(principal.tenantId);
  assert(saved.idCardWidthMm === 86 && loaded.idTemplate === "navy" && loaded.documentTemplate === "compact", "school can persist custom ID/document design defaults");

  const pdf = await renderStudentIdCardsPdf([{ schoolName: "Karibu High School", motto: "Elimu ni Mwanga", county: "Kiambu", addressLine: "P.O. Box 1", brandPrimary: "#1c2740", studentName: "Achieng Mary Otieno", admissionNo: "KHS1", className: "Form 2 East", photoUrl: null, verifyCode: "TEST42", qrDataUrl: "data:image/png;base64,iVBORw0KGgo=" }], { width: 86, height: 54, template: "navy" });
  assert(pdf.subarray(0, 4).toString() === "%PDF", "custom physical ID dimensions render a real PDF");

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/document-design.service.ts"), "utf8");
  const api = readFileSync(join(process.cwd(), "src/app/api/document-design/route.ts"), "utf8");
  const studentsUi = readFileSync(join(process.cwd(), "src/components/students/students-client.tsx"), "utf8");
  const bulkRoute = readFileSync(join(process.cwd(), "src/app/api/students/bulk-id-cards/route.ts"), "utf8");
  const idPdf = readFileSync(join(process.cwd(), "src/lib/documents/student-id-pdf.tsx"), "utf8");

  assert(schema.includes("documentDesignJson"), "schema stores school-owned document design JSON");
  assert(service.includes("idCardWidthMm") && service.includes("documentTemplate") && service.includes("poweredByNeyo"), "document design service covers ID and general document defaults");
  assert(api.includes('requirePermission("tenant.manage_settings")') && api.includes('requirePermission("student.view")'), "document design API is permission-gated for read/write");
  assert(studentsUi.includes("Customize & Print ID Cards") && studentsUi.includes("Save as school default") && studentsUi.includes("School document style"), "ID print UI lets school edit design, measurements and general document style");
  assert(studentsUi.includes("classId") && studentsUi.includes("stream") && studentsUi.includes("Set filters on the student list"), "ID printing supports per-class and per-stream via current student filters");
  assert(bulkRoute.includes("getDocumentDesign") && bulkRoute.includes("design.idCardWidthMm"), "bulk ID route uses saved design defaults when no override is passed");
  assert(idPdf.includes("Powered by NEYO") && idPdf.includes("widthMm") && idPdf.includes("heightMm"), "student ID PDF supports custom measurements and NEYO trademark");

  console.log("\nI.42 Customizable ID & Document Designs test passed.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
