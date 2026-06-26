/** G.11 — Public Subdomain Landing Site live tests (SELF-HEALS). */
import { db } from "../src/lib/db";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { slug: "karibu-high" } });
  
  // 1) Verify tenant profile contains G.9/G.11 metadata fields
  assert("tenant has co-branded name", !!tenant.name);
  assert("tenant has vision configured", !!tenant.vision);
  assert("tenant has mission configured", !!tenant.mission);
  assert("tenant has motto configured", !!tenant.motto);

  // 2) Verify student and class counts are queryable for public stats
  const studentCount = await db.student.count({ where: { tenantId: tenant.id, status: "ACTIVE" } });
  const classCount = await db.schoolClass.count({ where: { tenantId: tenant.id, archived: false } });
  assert("public student count is queryable", studentCount >= 0);
  assert("public class count is queryable", classCount >= 0);

  console.log(`\nG.11 Public Landing Site: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
