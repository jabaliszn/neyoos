/** G.30 — NEYO Health Check live tests (SELF-HEALS). */
import { db } from "../src/lib/db";
import { getCompanyHealthCheck } from "../src/lib/services/health-check.service";
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
  const superAdmin = await su("support@neyo.co.ke");
  const principal = await su("principal@karibuhigh.ac.ke");

  // 1) Super admin can get health check
  const pulse = await getCompanyHealthCheck(superAdmin);
  assert("company health check fetched successfully", pulse.length > 0);
  assert("contains Karibu High School", pulse.some((p) => p.name.includes("Karibu")));

  const karibu = pulse.find((p) => p.name.includes("Karibu"))!;
  assert("karibu modulesEnabled is correct (>0)", karibu.modulesEnabled > 0);
  assert("karibu loginsCount is tracked", karibu.loginsCount >= 0);

  // 2) Non-superadmin cannot access (should throw)
  try {
    await getCompanyHealthCheck(principal);
    assert("unauthorized blocked", false);
  } catch {
    assert("unauthorized blocked", true);
  }

  console.log(`\nG.30 NEYO Health Check: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
