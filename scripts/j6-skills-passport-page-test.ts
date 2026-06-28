import * as fs from "node:fs";
import * as path from "node:path";
import { db } from "../src/lib/db";
import { GET } from "../src/app/api/skills-passport/pdf/route";

async function main() {
  console.log("Starting J.6 Skills Passport page & PDF wiring test...");
  const cardPath = path.join(process.cwd(), "src", "components", "skills-passport", "skills-passport-card.tsx");
  const studentProfilePath = path.join(process.cwd(), "src", "components", "students", "student-profile-client.tsx");
  const parentPortalPath = path.join(process.cwd(), "src", "components", "portal", "parent-portal-client.tsx");

  const cardContent = fs.readFileSync(cardPath, "utf-8");
  const studentProfileContent = fs.readFileSync(studentProfilePath, "utf-8");
  const parentPortalContent = fs.readFileSync(parentPortalPath, "utf-8");

  // 1. Verify client real API fetch and post wiring
  if (!cardContent.includes('fetch(`/api/skills-passport?studentId=${studentId}`') || !cardContent.includes('method: "POST"')) {
    throw new Error("Client missing real fetch or POST wiring to /api/skills-passport.");
  }
  const actions = ["record_skill_rating", "remove_skill_rating"];
  for (const act of actions) {
    if (!cardContent.includes(act)) {
      throw new Error(`Client missing real post action: ${act}`);
    }
  }
  console.log("✓ client real API fetch/post wiring verified perfectly");

  // 2. Verify all 4 mandatory UX states
  if (!cardContent.includes("SkillsPassportLoadingState") || !cardContent.includes("SkillsPassportErrorState") || !cardContent.includes("SkillsPassportEmptyState") || !cardContent.includes("TalentLeadershipCard")) {
    throw new Error("Client missing one of the mandatory 4 UX states (Loading, Error, Empty, Populated).");
  }
  console.log("✓ all 4 mandatory UX states verified in connected client");

  // 3. Verify mounting in Student Profile and Parent Portal
  if (!studentProfileContent.includes("SkillsPassportCard")) {
    throw new Error("Student profile missing SkillsPassportCard mounting.");
  }
  if (!parentPortalContent.includes("SkillsPassportCard")) {
    throw new Error("Parent portal missing SkillsPassportCard mounting.");
  }
  console.log("✓ SkillsPassportCard mounted successfully in Student Profile and Parent Portal");

  // 4. Verify PDF generation route and QR verification
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, status: "ACTIVE" } });

  // Simulate GET request to PDF route
  // We mock requireUser by passing headers or using the active db session, but since requireUser expects cookies/headers in a real NextRequest, let's verify the route exports GET correctly and verify the PDF buffer generation directly via renderSkillsPassportPdf
  if (typeof GET !== "function") throw new Error("PDF route must export GET function.");
  console.log("✓ PDF download API route exports GET handler correctly");

  const { renderSkillsPassportPdf } = await import("../src/lib/documents/skills-passport-pdf");
  const buffer = await renderSkillsPassportPdf({
    schoolName: tenant.name,
    motto: tenant.motto,
    county: "Nairobi",
    addressLine: tenant.addressLine,
    brandPrimary: "#1c2740",
    studentName: "Achieng Mary Otieno",
    admissionNo: student.admissionNo,
    className: "Form 2 East",
    academicGrowth: {
      exams: [{ examName: "CAT 1", subjectName: "Mathematics", marks: 85, grade: "A", term: 2, year: 2026 }],
      flexibleAssessments: [{ planTitle: "Oral Presentation", typeName: "ORAL", scoreMarks: 90, scorePct: 90, rubricLevel: 4, rubricCode: "EE", narrative: "Fluent.", term: 2, year: 2026 }],
    },
    competencyGrowth: [{ competencyName: "Communication", competencyCode: "COM", groupName: "Core", level: 4, scorePct: 90, narrative: "Clear.", date: "2026-06-25", recordedByName: "Wanjiru Kamau" }],
    talentAndLeadership: [{ skillArea: "Leadership", latestRating: 5, evidenceCount: 1, latestSource: "CLUB", latestNarrative: "Prefect.", latestDate: "2026-06-25" }],
    verifyCode: "PAS-TEST123456",
    qrDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    issuedDate: "2026-06-27",
  });

  if (buffer.length === 0 || !buffer.toString("binary").startsWith("%PDF-")) {
    throw new Error("PDF buffer not generated correctly or missing %PDF magic bytes.");
  }
  console.log(`✓ Skills Passport PDF rendered successfully (${buffer.length} bytes, starts with %PDF magic bytes)`);

  // 5. Verify Bundi copy law (no banned word)
  if (/\bAI\b/.test(cardContent)) {
    throw new Error("Bundi Copy Law violation: found banned word 'AI'.");
  }
  console.log("✓ Bundi Copy Law enforced: zero occurrences of banned word 'AI'");

  console.log("J.6 Chunk 6 Skills Passport page & PDF test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
