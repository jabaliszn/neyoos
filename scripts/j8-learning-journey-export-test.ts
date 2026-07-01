import fs from "fs";
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { exportLearnerJourneyPack } from "../src/lib/services/learner-journey.service";
import { renderLearnerJourneyExportPdf } from "../src/lib/documents/learner-journey-export";

const db = new PrismaClient();

async function main() {
  const routeSource = fs.readFileSync("src/app/api/learner-journey/export/route.ts", "utf8");
  const cardSource = fs.readFileSync("src/components/learner-journey/learner-journey-card.tsx", "utf8");
  const serviceSource = fs.readFileSync("src/lib/services/learner-journey.service.ts", "utf8");

  assert(routeSource.includes("exportLearnerJourneyPack"), "export route must wire the real learner journey export service");
  assert(routeSource.includes("format") && routeSource.includes("json") && routeSource.includes("pdf"), "export route must support json and pdf formats");
  assert(cardSource.includes("exportJourney") && cardSource.includes("onExport={exportJourney}"), "learner journey card must wire the export action into the hero CTA");
  assert(cardSource.includes("onExport={exportJourney}") || routeSource.includes("Export learner journey"), "learner journey UI must expose export CTA wiring/copy");
  assert(serviceSource.includes("learner_journey.export_generated"), "learner journey export must audit generation");

  const principal = await db.user.findFirst({ where: { email: "principal@karibuhigh.ac.ke" } });
  const student = await db.student.findFirst({ where: { firstName: "Atieno", tenant: { slug: "karibu-high" } } });
  if (!principal || !student) throw new Error("Expected seeded principal and Atieno student.");

  const user = {
    id: principal.id,
    tenantId: principal.tenantId,
    role: principal.role as any,
    secondaryRole: principal.secondaryRole as any,
    fullName: principal.fullName,
  };

  const pack = await exportLearnerJourneyPack(user, { studentId: student.id, mode: "parent", limit: 40 });
  assert(pack.export.transferFriendly === true, "export pack must mark itself transfer-friendly");
  assert(pack.manifest.version === "1.0", "export pack manifest version must be stable");
  assert(Array.isArray(pack.journey), "export pack must contain journey entries array");
  assert(pack.journey.every((entry: any) => entry.visibility === "PARENT_SAFE"), "parent export should remain parent-safe");
  assert(typeof pack.export.verifyCode === "string" && pack.export.verifyCode.length >= 8, "export pack must include a verification code");

  const pdf = await renderLearnerJourneyExportPdf({
    schoolName: "Karibu High School",
    motto: "Learn. Lead. Serve.",
    county: "Nairobi",
    addressLine: "P.O. Box 123 Nairobi",
    brandPrimary: "#1c2740",
    studentName: pack.learner.name,
    admissionNo: pack.learner.admissionNo,
    className: pack.learner.className,
    mode: "parent",
    generatedDate: pack.manifest.generatedAt.slice(0, 10),
    verifyCode: pack.export.verifyCode,
    entries: pack.journey,
  });
  const header = Buffer.from(pdf).slice(0, 4).toString("utf8");
  assert(header === "%PDF", "learner journey export PDF must render a real PDF buffer");

  console.log(`✓ transfer-friendly learner journey export pack generated (${pack.journey.length} entries)`);
  console.log("✓ learner journey export PDF renderer returns a real PDF buffer");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await db.$disconnect();
});
