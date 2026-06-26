/** B.1 Guardians — multiple guardians live test. */
import { db } from "../src/lib/db";
import { addGuardian, setPrimaryGuardian } from "../src/lib/services/student.service";
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

  // Clear existing non-seeded test guardians to prevent dirty state
  await db.studentGuardian.deleteMany({
    where: {
      studentId: student.id,
      guardian: { phone: { in: ["+254711223344", "+254722334455"] } },
    },
  });
  await db.guardian.deleteMany({
    where: {
      tenantId: principal.tenantId,
      phone: { in: ["+254711223344", "+254722334455"] },
    },
  });

  // 1) Add a new secondary guardian (Mother)
  const g1 = await addGuardian(principal, student.id, {
    fullName: "Atieno Mary Mother",
    phone: "0711 223 344",
    email: "mother@gmail.com",
    nationalId: "98765432",
    relationship: "Mother",
    isPrimary: false,
    createLogin: false,
  });

  const links1 = await db.studentGuardian.findMany({
    where: { studentId: student.id },
    include: { guardian: true },
  });
  
  assert("new guardian linked successfully", links1.some((l) => l.guardianId === g1.id));
  assert("new guardian relationship is Mother", links1.find((l) => l.guardianId === g1.id)?.relationship === "Mother");
  assert("new guardian is not primary by default", links1.find((l) => l.guardianId === g1.id)?.isPrimary === false);

  // 2) Set the newly added guardian as primary
  await setPrimaryGuardian(principal, student.id, g1.id);

  const links2 = await db.studentGuardian.findMany({
    where: { studentId: student.id },
  });

  assert("new guardian is now primary", links2.find((l) => l.guardianId === g1.id)?.isPrimary === true);
  assert("other guardians are updated to not primary", links2.filter((l) => l.guardianId !== g1.id).every((l) => l.isPrimary === false));

  // 3) Add a guardian directly set as primary
  const g2 = await addGuardian(principal, student.id, {
    fullName: "Atieno Mary Father",
    phone: "0722 334 455",
    relationship: "Father",
    isPrimary: true,
    createLogin: false,
  });

  const links3 = await db.studentGuardian.findMany({
    where: { studentId: student.id },
  });

  assert("directly-added primary guardian is primary", links3.find((l) => l.guardianId === g2.id)?.isPrimary === true);
  assert("previously primary guardian is no longer primary", links3.find((l) => l.guardianId === g1.id)?.isPrimary === false);

  // Clean up
  await db.studentGuardian.deleteMany({ where: { studentId: student.id, guardianId: { in: [g1.id, g2.id] } } });
  await db.guardian.deleteMany({ where: { id: { in: [g1.id, g2.id] } } });
  
  // Set original primary guardian back to true
  const originalLink = await db.studentGuardian.findFirst({ where: { studentId: student.id } });
  if (originalLink) {
    await db.studentGuardian.update({
      where: { id: originalLink.id },
      data: { isPrimary: true },
    });
  }

  console.log(`\nGuardians: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
