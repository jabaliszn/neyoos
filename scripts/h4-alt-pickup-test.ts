/** H.4 Alternate Pickup verification — live test (self-healing). */
import { db } from "../src/lib/db";
import { createAltPickup, listAltPickups, verifyAltPickup, cancelAltPickup, SecurityError } from "../src/lib/services/security.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) { return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser; }

async function main() {
  const guard = await asUser("frontoffice@karibuhigh.ac.ke"); // RECEPTIONIST (security.view/manage)
  const student = await db.student.findFirstOrThrow({ where: { tenant: { slug: "karibu-high" }, status: "ACTIVE" } });
  const tenantId = guard.tenantId;
  let pass = 0, fail = 0;
  const ok = (c: boolean, l: string) => { if (c) { pass++; console.log("  ✓", l); } else { fail++; console.log("  ✗ FAIL:", l); } };

  await db.altPickupAuthorization.deleteMany({ where: { tenantId, studentId: student.id } });

  // 1) create with secure code + screenshot
  const created = await createAltPickup(guard, {
    studentId: student.id, pickerName: "Auntie Njeri", pickerPhone: "+254712000111",
    relationship: "Aunt", screenshotUrl: "/api/files/serve?key=tenants/x/pickup/msg.jpg", screenshotName: "parent-confirmation.jpg",
  });
  ok(/^PK-[A-Z0-9]{4}$/.test(created.code), "created with secure code " + created.code);

  // 2) listed as active for the gate
  const list1 = await listAltPickups(guard);
  ok(list1.some((r) => r.id === created.id && r.screenshotUrl), "active authorization listed (with screenshot) for the gate");

  // 3) wrong code rejected
  try { await verifyAltPickup(guard, "PK-ZZZZ"); ok(false, "wrong code should be NOT_FOUND"); }
  catch (e: any) { ok(e instanceof SecurityError && e.code === "NOT_FOUND", "wrong code rejected (NOT_FOUND)"); }

  // 4) verify by code (case-insensitive) → USED + returns screenshot for the guard
  const v = await verifyAltPickup(guard, created.code.toLowerCase());
  ok(v.success && v.studentName.includes(student.lastName), "verified by code → success, student named");
  ok(v.screenshotUrl?.includes("msg.jpg") === true, "guard gets the screenshot proof on verify");
  const row = await db.altPickupAuthorization.findUniqueOrThrow({ where: { id: created.id } });
  ok(row.status === "USED" && !!row.verifiedAt, "authorization marked USED + verifiedAt stamped");

  // 5) double-verify blocked (single-use)
  try { await verifyAltPickup(guard, created.code); ok(false, "double-verify should be blocked"); }
  catch (e: any) { ok(e?.code === "ALREADY", "double-verify blocked (ALREADY — do not allow exit)"); }

  // 6) used one no longer listed as active
  const list2 = await listAltPickups(guard);
  ok(!list2.some((r) => r.id === created.id), "USED authorization no longer in the active gate list");

  // 7) expiry: create one already expired → verify rejected
  const expired = await createAltPickup(guard, { studentId: student.id, pickerName: "Late Picker", validHours: 1 });
  await db.altPickupAuthorization.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 3600_000) } });
  try { await verifyAltPickup(guard, expired.code); ok(false, "expired code should be rejected"); }
  catch (e: any) { ok(e?.code === "INVALID", "expired code rejected (INVALID)"); }

  // 8) cancel an active one
  const c = await createAltPickup(guard, { studentId: student.id, pickerName: "Cancel Me" });
  await cancelAltPickup(guard, c.id);
  try { await verifyAltPickup(guard, c.code); ok(false, "cancelled code should be rejected"); }
  catch (e: any) { ok(e?.code === "ALREADY", "cancelled code rejected (ALREADY)"); }

  // 9) audit trail
  const a = await db.auditLog.findFirst({ where: { action: "security.alt_pickup_verified" }, orderBy: { createdAt: "desc" } });
  ok(!!a, "verification audited (security.alt_pickup_verified)");

  await db.altPickupAuthorization.deleteMany({ where: { tenantId, studentId: student.id } });
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
