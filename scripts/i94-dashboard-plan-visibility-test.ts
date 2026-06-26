import { effectivePermissionsForUser } from "@/lib/core/session";
import { db } from "@/lib/db";
import { generateNeyoLoginId } from "@/lib/services/identity.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import { readFileSync } from "node:fs";

function asUser(u: any): SessionUser { return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" }; }
function assert(c: unknown, m: string) { if (!c) throw new Error(m); console.log(`  ✓ ${m}`); }

async function main() {
  console.log("I.94 dashboard plan deep-link + role card visibility test");
  const source = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
  assert(source.includes('href="/settings/billing"') && source.includes("Subscription Plan"), "subscription plan card deep-links to Settings → Billing");
  assert(source.includes("Subscription plan needs attention") && source.includes("/settings/billing") && source.includes("daysToPlanEnd"), "dashboard creates expiring-plan notification with billing deep-link");
  assert(source.includes("effectivePermissionsForUser") && source.includes("canSeeFinanceCards") && source.includes("canSeeAttendanceCard") && source.includes("canSeeBillingCard"), "dashboard cards are gated by effective per-user permissions");
  assert(source.includes("canSeeFinanceCards && <Link href=\"/finance\"") && source.includes("canSeeStudentsCard && <Link href=\"/students\"") && source.includes("canSeeStaffCard && <Link href=\"/staff\""), "finance/student/staff dashboard cards render only for concerned roles");

  const principal = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const tenantId = principal.tenantId;
  const kitchen = await db.user.create({ data: { tenantId, neyoLoginId: await generateNeyoLoginId(), fullName: "Kitchen Card Gate", email: `kitchen-cards-${Date.now()}@karibuhigh.ac.ke`, role: "SUPPORT_STAFF", isActive: true } });
  await db.staffProfile.create({ data: { tenantId, userId: kitchen.id, contractType: "PERMANENT", visibilityAreas: JSON.stringify(["KITCHEN"]) } as any });
  try {
    const perms = await effectivePermissionsForUser(asUser(kitchen));
    assert(!perms.includes("finance.view") && !perms.includes("staff.view") && !perms.includes("student.view"), "kitchen staff lacks permissions for finance/staff/student dashboard cards");
    assert(perms.includes("cafeteria.view"), "kitchen staff keeps their relevant cafeteria visibility");
  } finally {
    await db.staffProfile.deleteMany({ where: { userId: kitchen.id } });
    await db.user.deleteMany({ where: { id: kitchen.id } });
  }

  console.log("\n✅ I.94 dashboard plan deep-link + role card visibility test passed");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
