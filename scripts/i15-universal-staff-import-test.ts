import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { importStaffBatch, staffRowsFromText } from "@/lib/services/staff-import.service";
import { upsertTerm } from "@/lib/services/academics.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function expectForbidden(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (e) {
    assert(/Principal|Owner|FORBIDDEN|academic term/i.test((e as Error).message), message);
    return;
  }
  throw new Error(`Expected forbidden: ${message}`);
}

async function expectDuplicate(fn: () => Promise<unknown>, message: string) {
  try {
    await fn();
  } catch (e) {
    assert(/duplicate|already exists|Import denied/i.test((e as Error).message), message);
    return;
  }
  throw new Error(`Expected duplicate denial: ${message}`);
}

async function main() {
  const principalRow = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const deputyRow = await db.user.findFirstOrThrow({ where: { email: "deputy@karibuhigh.ac.ke" } });
  const principal = asUser(principalRow);
  const deputy = asUser(deputyRow);
  const suffix = Date.now().toString().slice(-6);
  const email = `i15.staff.${suffix}@karibuhigh.ac.ke`;
  const tsc = `TSC-I15-${suffix}`;
  const nationalId = `ID-I15-${suffix}`;

  const csv = [
    "Full Name,Role,Phone,Email,TSC Number,National ID,KRA PIN,Qualifications,Employment Date,Contract Type,Emergency Contact",
    `Nekesa Violet,Teacher,0711${suffix.slice(0, 6)},${email},${tsc},${nationalId},A123456789Z,B.Ed English,23/06/2026,Contract,Kamau +254700000000`,
  ].join("\n");

  const rows = staffRowsFromText(csv, true);
  assert(rows[0].fullName === "Nekesa Violet", "staff import auto-maps CSV headers into staff fields");
  assert(rows[0].role === "Teacher", "staff import accepts human role labels before service normalization");

  const result = await importStaffBatch(principal, rows);
  assert(result.created === 1, "staff import creates a real staff user from rule-based CSV/XLSX/paste rows");

  const created = await db.user.findFirstOrThrow({ where: { tenantId: principal.tenantId, email } });
  const profile = await db.staffProfile.findFirstOrThrow({ where: { tenantId: principal.tenantId, userId: created.id } });
  assert(created.role === "TEACHER" && created.neyoLoginId.startsWith("NEYO"), "imported staff receives normalized role and NEYO login ID");
  assert(profile.tscNumber === tsc && profile.nationalId === nationalId && profile.contractType === "CONTRACT", "staff import writes HR profile fields, TSC, National ID and contract type");

  await expectDuplicate(
    () => importStaffBatch(principal, [
      { fullName: "Duplicate One", role: "TEACHER", phone: "+254711000001", email: `dupe1.${suffix}@karibuhigh.ac.ke`, tscNumber: `TSC-DUPE-A-${suffix}`, nationalId: `ID-DUPE-A-${suffix}` },
      { fullName: "Duplicate Two", role: "TEACHER", phone: "+254711000001", email: `dupe2.${suffix}@karibuhigh.ac.ke`, tscNumber: `TSC-DUPE-B-${suffix}`, nationalId: `ID-DUPE-B-${suffix}` },
    ]),
    "staff import denies duplicate fields before creating partial users"
  );

  await expectForbidden(
    () => upsertTerm(deputy, { year: 2027, term: 1, startDate: "2027-01-05", endDate: "2027-04-04", current: false }),
    "term dates are editable by Principal/Owner only, not Deputy/teacher users"
  );

  const client = readFileSync(join(process.cwd(), "src/components/hr/staff-client.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/hr/import/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/staff-import.service.ts"), "utf8");
  const studentValidation = readFileSync(join(process.cwd(), "src/lib/validations/student-import.ts"), "utf8");
  const studentService = readFileSync(join(process.cwd(), "src/lib/services/student-import.service.ts"), "utf8");

  assert(client.includes("Bulk Import Staff") && client.includes('accept=".csv,.tsv,.txt,.xlsx"') && client.includes("Bundi handwriting scan"), "Staff Directory has the import menu with CSV/XLSX and Bundi-ready copy");
  assert(route.includes("multipart/form-data") && route.includes("staffRowsFromFile") && route.includes("staffRowsFromText"), "staff import API accepts file upload and pasted text, not only fixed JSON rows");
  assert(service.includes("autoMapStaffColumns") && service.includes("parseXlsx") && service.includes("Duplicate"), "staff import service has rule-based auto-mapping, Excel parsing and duplicate denial");
  assert(studentValidation.includes("MAX_IMPORT_ROWS") && studentValidation.includes("mapping") && studentService.includes("parseXlsx") && studentService.includes("autoMapColumns"), "student import is standalone and ready for Bundi-produced rows while working rule-based now");
  assert(!/openai|anthropic|claude/i.test(studentService + service), "staff/student import do not depend on any assistant layer");

  await db.staffProfile.deleteMany({ where: { tenantId: principal.tenantId, userId: created.id } });
  await db.user.delete({ where: { id: created.id } });

  console.log("\nI.15 Universal Staff Import test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
