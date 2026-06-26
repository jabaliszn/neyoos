import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";
import {
  listEntranceExamPapers,
  markEntranceExamPaperPrinted,
  saveEntranceExamPaper,
} from "../src/lib/services/entrance-exam.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function userByEmail(email: string): Promise<SessionUser> {
  const user = await db.user.findFirst({ where: { email } });
  if (!user) throw new Error(`Missing user ${email}`);
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: user.secondaryRole as SessionUser["secondaryRole"],
    language: user.language,
  };
}

async function main() {
  const principal = await userByEmail("principal@karibuhigh.ac.ke");

  const seeded = await listEntranceExamPapers(principal);
  assert(seeded.some((p) => p.classId && p.classLabel === "Form 2 East"), "seed includes an entrance paper for exact class Form 2 East");
  assert(seeded.some((p) => p.hardcopyLocation.includes("Admissions office")), "seeded papers store mandatory hard-copy file location");

  const north = await db.schoolClass.create({ data: { tenantId: principal.tenantId, level: "Form 3", stream: "North", curriculum: "8-4-4" } });
  const South = await db.schoolClass.create({ data: { tenantId: principal.tenantId, level: "Form 3", stream: "South", curriculum: "8-4-4" } });
  try {
    const fileUrl = `/api/files/serve?key=${encodeURIComponent(`tenants/${principal.tenantId}/admissions/test-form3.pdf`)}`;
    const p1 = await saveEntranceExamPaper(principal, {
      classId: north.id,
      title: "Form 3 North interview paper",
      fileUrl,
      fileName: "form3-north.pdf",
      hardcopyLocation: "Admissions cabinet B / File 3N",
    });
    const p2 = await saveEntranceExamPaper(principal, {
      classId: South.id,
      title: "Form 3 South interview paper",
      fileUrl,
      fileName: "form3-south.pdf",
      hardcopyLocation: "Admissions cabinet B / File 3S",
    });
    assert(p1.classLevel === "Form 3" && p2.classLevel === "Form 3", "two streams can share the same class level");
    assert(p1.classId !== p2.classId && p1.classLabel !== p2.classLabel, "papers are stored per exact class/stream, not one per level");

    const printed = await markEntranceExamPaperPrinted(principal, p1.id);
    assert(printed.printCount === p1.printCount + 1, "print/download route service increments print count");

    const audit = await db.auditLog.findFirst({
      where: { tenantId: principal.tenantId, action: "admissions.entrance_exam_printed", entityId: p1.id },
    });
    assert(Boolean(audit), "printing entrance paper is audit logged");
  } finally {
    await db.entranceExamPaper.deleteMany({ where: { tenantId: principal.tenantId, classId: { in: [north.id, South.id] } } });
    await db.schoolClass.deleteMany({ where: { id: { in: [north.id, South.id] } } });
  }

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/admissions/entrance-exams/route.ts"), "utf8");
  const printRoute = readFileSync(join(process.cwd(), "src/app/api/admissions/entrance-exams/[id]/print/route.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/admissions/admissions-client.tsx"), "utf8");

  assert(schema.includes("@@unique([tenantId, classId])") && !schema.includes("@@unique([tenantId, classLevel])"), "schema uniqueness is per classId, not per classLevel");
  assert(route.includes('requirePermission("student.create")') && route.includes("entranceExamPaperSchema"), "save API is admissions-role gated and Zod validated");
  assert(printRoute.includes("markEntranceExamPaperPrinted") && printRoute.includes("NextResponse.redirect"), "print API tracks access then redirects to the stored paper");
  assert(client.includes("classes.map") && client.includes("hardcopyLocation") && client.includes("Print / Download"), "Admissions UI lists exact classes, captures hard-copy location, and exposes print/download");

  console.log("\nI.11 Admissions Entrance Exam Vault test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
