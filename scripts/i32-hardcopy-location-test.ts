import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { addDocument } from "@/lib/services/student.service";
import { addDocumentSchema } from "@/lib/validations/student";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.32 hardcopy location test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const student = await db.student.findFirstOrThrow({ where: { tenantId: principal.tenantId, status: "ACTIVE" } });

  const bad = addDocumentSchema.safeParse({ label: "Birth cert", fileUrl: "/api/files/serve?k=test", fileName: "birth.pdf" });
  assert(!bad.success, "student document validation requires hardcopy location");

  const doc = await addDocument(principal, student.id, {
    label: "Birth cert test",
    fileUrl: "/api/files/serve?k=test-hardcopy",
    fileName: "birth.pdf",
    hardcopyLocation: "Cabinet 2 / File 14",
  });
  const saved = await db.studentDocument.findUniqueOrThrow({ where: { id: doc.id } });
  assert(saved.hardcopyLocation === "Cabinet 2 / File 14", "student document stores hardcopy location");
  await db.studentDocument.delete({ where: { id: doc.id } });

  console.log("\n✅ I.32 hardcopy location test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
