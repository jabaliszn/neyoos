import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { can } from "@/lib/core/permissions";
import { autoAllocateHostelBeds } from "@/lib/services/hostel.service";
import { transferStudent } from "@/lib/services/student.service";

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

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
  const hostelMasterRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "HOSTEL_MASTER" } });
  const principal = asUser(principalRow);
  const hostelMaster = asUser(hostelMasterRow);
  const suffix = Date.now().toString().slice(-6);
  const class1 = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 1" } });
  const class2 = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 2" } });

  assert(can(hostelMaster.role, "hostel.manage"), "Boarding department / Hostel Master can manage dorm automation");
  assert(can(principal.role, "hostel.manage"), "school heads can manage dorm automation");

  const hostel = await db.hostel.create({ data: { tenantId: tenant.id, name: `I16 Mixed House ${suffix}`, gender: "MIXED", masterId: hostelMaster.id, boardingFeeKes: 15000 } });
  const room = await db.hostelRoom.create({ data: { tenantId: tenant.id, hostelId: hostel.id, name: "Room 1", capacity: 20 } });

  const maleBoarder = await db.student.create({ data: { tenantId: tenant.id, admissionNo: `I16-M-${suffix}`, firstName: "Kiptoo", middleName: null, lastName: "Test", gender: "M", classId: class1.id, status: "ACTIVE", boardingType: "BOARDER" } });
  const femaleBoarder = await db.student.create({ data: { tenantId: tenant.id, admissionNo: `I16-F-${suffix}`, firstName: "Akinyi", middleName: null, lastName: "Test", gender: "F", classId: class2.id, status: "ACTIVE", boardingType: "BOARDER" } });
  const dayScholar = await db.student.create({ data: { tenantId: tenant.id, admissionNo: `I16-D-${suffix}`, firstName: "Mwikali", middleName: null, lastName: "Day", gender: "F", classId: class2.id, status: "ACTIVE", boardingType: "DAY" } });

  try {
    const mixed = await autoAllocateHostelBeds(hostelMaster, hostel.id, "MIXED");
    assert(mixed.allocatedCount >= 2 && mixed.hostelGender === "MIXED" && mixed.strategy === "MIXED", "mixed dorm strategy allocates both boys and girls into a MIXED hostel");

    const allocations = await db.hostelAllocation.findMany({ where: { tenantId: tenant.id, roomId: room.id, releasedAt: null }, orderBy: { bedNo: "asc" } });
    const allocatedIds = allocations.map((a) => a.studentId);
    assert(allocatedIds.includes(maleBoarder.id) && allocatedIds.includes(femaleBoarder.id), "auto-placement creates real bed allocations for boarders");
    assert(!allocatedIds.includes(dayScholar.id), "auto-placement skips DAY scholars using Student.boardingType");

    await transferStudent(principal, maleBoarder.id, {
      destinationSchool: "Nakuru Boys High School",
      destinationCounty: "Nakuru",
      transferDate: "2026-06-23",
      reason: "relocation",
    });
    const released = await db.hostelAllocation.findFirstOrThrow({ where: { tenantId: tenant.id, studentId: maleBoarder.id } });
    assert(Boolean(released.releasedAt), "student transfer automatically frees the occupied dorm bed");

    const transferAudit = await db.auditLog.findFirstOrThrow({ where: { tenantId: tenant.id, action: "student.transfer", entityId: maleBoarder.id }, orderBy: { createdAt: "desc" } });
    assert((transferAudit.metadata || "").includes("freedHostelBeds"), "transfer audit records freed hostel bed space");

    const client = readFileSync(join(process.cwd(), "src/components/hostel/hostel-client.tsx"), "utf8");
    const api = readFileSync(join(process.cwd(), "src/app/api/hostel/route.ts"), "utf8");
    const service = readFileSync(join(process.cwd(), "src/lib/services/hostel.service.ts"), "utf8");
    const studentService = readFileSync(join(process.cwd(), "src/lib/services/student.service.ts"), "utf8");

    assert(client.includes("Form-Based") && client.includes("Mixed Levels") && client.includes("Run Placement Solver"), "Hostel UI lets the school switch between form-based and mixed placement strategies");
    assert(api.includes('z.enum(["FORM", "MIXED"])') && api.includes("autoAllocateHostelBeds"), "Hostel API exposes the real auto-allocation action with strategy validation");
    assert(service.includes('boardingType: "BOARDER"') && service.includes("MIXED hostels accept both boys and girls"), "Hostel service excludes day scholars and supports MIXED hostels");
    assert(studentService.includes("freedHostelBeds") && studentService.includes("hostelAllocation.updateMany"), "Transfer service releases and records hostel bed space");

    console.log("\nI.16 Hostel / Dorm Automation test passed.");
  } finally {
    await db.hostelAllocation.deleteMany({ where: { tenantId: tenant.id, studentId: { in: [maleBoarder.id, femaleBoarder.id, dayScholar.id] } } });
    await db.studentTransfer.deleteMany({ where: { tenantId: tenant.id, studentId: { in: [maleBoarder.id, femaleBoarder.id, dayScholar.id] } } });
    await db.student.deleteMany({ where: { tenantId: tenant.id, id: { in: [maleBoarder.id, femaleBoarder.id, dayScholar.id] } } });
    await db.hostelRoom.deleteMany({ where: { tenantId: tenant.id, hostelId: hostel.id } });
    await db.hostel.deleteMany({ where: { tenantId: tenant.id, id: hostel.id } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
