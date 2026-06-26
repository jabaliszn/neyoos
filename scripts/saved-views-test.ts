/** G.8 Polish — Saved views live test (SELF-HEALS). */
import { db } from "../src/lib/db";
import { createSavedView, listSavedViews, deleteSavedView } from "../src/lib/services/saved-view.service";
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

  // Cleanup prior leftovers
  await db.savedView.deleteMany({
    where: { tenantId: principal.tenantId, userId: principal.id, name: { startsWith: "TEST " } },
  });

  // 1) Create a saved view
  const v1 = await createSavedView(principal, {
    entityType: "student",
    name: "TEST Form 2 Boys",
    filters: { classId: "F2E", gender: "M" },
  });
  assert("saved view created", !!v1.id && v1.name === "TEST Form 2 Boys");

  // 2) Prevent duplicate names for the same user + entityType
  try {
    await createSavedView(principal, {
      entityType: "student",
      name: "TEST Form 2 Boys",
      filters: { classId: "F2E" },
    });
    assert("duplicate name blocked", false);
  } catch {
    assert("duplicate name blocked", true);
  }

  // 3) List saved views for student
  const views = await listSavedViews(principal, "student");
  assert("list includes newly created view", views.some((v) => v.id === v1.id));
  assert("list decodes filters correctly", views.find((v) => v.id === v1.id)?.filters.classId === "F2E");

  // 4) Delete a saved view
  await deleteSavedView(principal, v1.id);
  const viewsAfter = await listSavedViews(principal, "student");
  assert("view deleted successfully", !viewsAfter.some((v) => v.id === v1.id));

  console.log(`\nG.8 Saved Views: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
