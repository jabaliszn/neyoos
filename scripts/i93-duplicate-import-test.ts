import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { importStaffBatch, StaffImportError } from "@/lib/services/staff-import.service";
import { commitImport, previewImport } from "@/lib/services/student-import.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}
async function expectDuplicate(fn: () => Promise<unknown>, label: string) {
  try { await fn(); } catch (e) {
    assert(e instanceof Error && /duplicate|already exists|Import denied/i.test(e.message), label);
    return;
  }
  throw new Error(`Expected duplicate denial: ${label}`);
}

async function main() {
  console.log("I.93 duplicate import prevention test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const tenantId = user.tenantId;

  await expectDuplicate(
    () => importStaffBatch(user, [
      { fullName: "Test One", role: "TEACHER", phone: "0711111111", email: "dupe.staff@karibu.test", tscNumber: "TSC-DUPE-1", nationalId: "ID-DUPE-1" },
      { fullName: "Test Two", role: "TEACHER", phone: "0711111111", email: "dupe2.staff@karibu.test", tscNumber: "TSC-DUPE-2", nationalId: "ID-DUPE-2" },
    ]),
    "staff import denies duplicate phone inside file"
  );

  await expectDuplicate(
    () => importStaffBatch(user, [
      { fullName: "Existing Email", role: "TEACHER", phone: "0711999000", email: "principal@karibuhigh.ac.ke", tscNumber: "TSC-UNIQUE", nationalId: "ID-UNIQUE" },
    ]),
    "staff import denies existing email"
  );

  await withTenant(tenantId, async () => {
    const rows = [
      ["Full Name", "Gender", "Class", "Admission No", "UPI", "Birth Cert"],
      ["Duplicate Learner", "F", "Form 2 East", "DUP-ADM-1", "UPI-DUP-1", "BC-DUP-1"],
      ["Duplicate Learner Two", "M", "Form 2 East", "DUP-ADM-1", "UPI-DUP-2", "BC-DUP-2"],
    ];
    const mapping = [
      { column: 0, field: "fullName" as const },
      { column: 1, field: "gender" as const },
      { column: 2, field: "className" as const },
      { column: 3, field: "legacyAdmissionNo" as const },
      { column: 4, field: "upiNumber" as const },
      { column: 5, field: "birthCertNo" as const },
    ];
    const preview = await previewImport(user, rows, true, mapping);
    assert(preview.issues.some((i: any) => i.message.includes("Duplicate school admission number")), "student import preview flags duplicate school admission number in file");
    await expectDuplicate(
      () => commitImport(user, { source: "paste", rows, hasHeader: true, mapping, seedRequirements: false, skipInvalid: true }),
      "student import commit denies duplicate school admission number"
    );

    const existing = await db.student.findFirstOrThrow({ where: { tenantId, admissionNo: "KHS1" } });
    const rows2 = [
      ["Full Name", "Gender", "Class", "Admission No"],
      ["Existing Legacy", "F", "Form 2 East", existing.admissionNo],
    ];
    const mapping2 = [
      { column: 0, field: "fullName" as const },
      { column: 1, field: "gender" as const },
      { column: 2, field: "className" as const },
      { column: 3, field: "legacyAdmissionNo" as const },
    ];
    await expectDuplicate(
      () => commitImport(user, { source: "paste", rows: rows2, hasHeader: true, mapping: mapping2, seedRequirements: false, skipInvalid: true }),
      "student import denies existing NEYO/school admission number"
    );
  });

  console.log("\n✅ I.93 duplicate import prevention test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
