import { db } from "@/lib/db";
import { effectivePermissionsForUser } from "@/lib/core/session";
import { generateNeyoLoginId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }
function assert(c: unknown, m: string) { if (!c) throw new Error(m); console.log(`  ✓ ${m}`); }

async function main() {
  console.log("I.92 strict per-role visibility test");
  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const tenantId = principal.tenantId;
  const kitchen = await db.user.create({ data: { tenantId, neyoLoginId: await generateNeyoLoginId(), fullName: "Kitchen Staff Strict", email: `kitchen-${Date.now()}@karibuhigh.ac.ke`, role: "SUPPORT_STAFF", isActive: true } });
  const transport = await db.user.create({ data: { tenantId, neyoLoginId: await generateNeyoLoginId(), fullName: "Transport Staff Strict", email: `transport-${Date.now()}@karibuhigh.ac.ke`, role: "SUPPORT_STAFF", isActive: true } });
  await db.staffProfile.create({ data: { tenantId, userId: kitchen.id, contractType: "PERMANENT", visibilityAreas: JSON.stringify(["KITCHEN"]) } as any });
  await db.staffProfile.create({ data: { tenantId, userId: transport.id, contractType: "PERMANENT", visibilityAreas: JSON.stringify(["TRANSPORT"]) } as any });
  try {
    const kitchenPerms = await effectivePermissionsForUser(asUser(kitchen));
    assert(kitchenPerms.includes("cafeteria.view") && !kitchenPerms.includes("clinic.view") && !kitchenPerms.includes("transport.view"), "kitchen support staff sees cafeteria only, not clinic/transport");
    const transportPerms = await effectivePermissionsForUser(asUser(transport));
    assert(transportPerms.includes("transport.view") && !transportPerms.includes("cafeteria.view") && !transportPerms.includes("clinic.view"), "transport support staff sees transport only, not kitchen/clinic");
    const bursar = asUser(await db.user.findFirstOrThrow({ where: { email: "bursar@karibuhigh.ac.ke" } }));
    const bursarPerms = await effectivePermissionsForUser(bursar);
    assert(!bursarPerms.includes("transport.manage") && !bursarPerms.includes("clinic.manage"), "bursar does not get unrelated transport/clinic management");
    const librarian = asUser(await db.user.findFirstOrThrow({ where: { email: "library@karibuhigh.ac.ke" } }));
    const librarianPerms = await effectivePermissionsForUser(librarian);
    assert(librarianPerms.includes("library.manage") && !librarianPerms.includes("finance.view") && !librarianPerms.includes("student.edit"), "librarian sees library duties only");

    const session = readFileSync("src/lib/core/session.ts", "utf8");
    assert(session.includes("effectivePermissionsForUser") && session.includes("visibilityAreas"), "backend permission guard uses per-staff visibility areas");
    const api = readFileSync("src/app/api/auth/permissions/route.ts", "utf8");
    assert(api.includes("effectivePermissionsForUser"), "frontend nav permissions use effective per-user permissions");
  } finally {
    await db.staffProfile.deleteMany({ where: { userId: { in: [kitchen.id, transport.id] } } });
    await db.user.deleteMany({ where: { id: { in: [kitchen.id, transport.id] } } });
  }
  console.log("\n✅ I.92 strict per-role visibility test passed");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
