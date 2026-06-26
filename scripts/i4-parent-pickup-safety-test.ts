/**
 * I.4 — parent-initiated safe pickup self-service.
 * Verifies parent can manage pickup people for own child, create one-time code,
 * gate can search by National ID, and pickup verification sends parent SMS/audit.
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import { group, testAsync, expect, summary } from "./_assert";
import {
  parentPickupBoard,
  parentAddPickupPerson,
  parentRemovePickupPerson,
  parentCreateAltPickup,
  parentCancelAltPickup,
} from "@/lib/services/parent-portal.service";
import { pickupListFor, confirmPickupPerson, verifyAltPickup } from "@/lib/services/security.service";

function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, role: u.role, secondaryRole: u.secondaryRole,
    fullName: u.fullName, email: u.email, phone: u.phone, language: u.language ?? "en",
    neyoLoginId: u.neyoLoginId, viewAsReadOnly: false,
  } as SessionUser;
}

async function expectNotFound(fn: () => Promise<unknown>) {
  try { await fn(); } catch (e) {
    if ((e as any).code === "NOT_FOUND") return;
    throw e;
  }
  throw new Error("expected NOT_FOUND, but action succeeded");
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const parent = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "parent@karibuhigh.ac.ke" } }));
  const principal = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } }));
  const ownChild = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, guardians: { some: { guardian: { userId: parent.id } } } } });
  const otherChild = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, id: { not: ownChild.id } } });

  const testNationalId = "I4ID12345";
  let pickupId = "";
  let altId = "";
  let altCode = "";

  try {
    group("I.4 parent pickup safety");

    await testAsync("parent initially loads pickup board for own child", async () => {
      const board = await parentPickupBoard(parent, ownChild.id);
      expect(Array.isArray(board.pickupPersons)).toBe(true);
      expect(Array.isArray(board.altPickups)).toBe(true);
    });

    await testAsync("parent cannot manage another family's child", async () => {
      await expectNotFound(() => parentPickupBoard(parent, otherChild.id));
    });

    await testAsync("parent adds permanent pickup person with National ID", async () => {
      const person = await parentAddPickupPerson(parent, {
        studentId: ownChild.id,
        fullName: "Njeri Wambui Test",
        relationship: "Aunt",
        phone: "+254711222333",
        nationalId: testNationalId,
      });
      pickupId = person.id;
      expect(person.nationalId).toBe(testNationalId);
    });

    await testAsync("gate can find pickup authorization by National ID", async () => {
      const rows = await pickupListFor(principal, testNationalId);
      expect(rows.some((r) => r.studentId === ownChild.id && r.persons.some((p) => p.id === pickupId))).toBe(true);
    });

    await testAsync("gate confirms pickup and parent SMS/audit is recorded", async () => {
      const before = await db.auditLog.count({ where: { tenantId: tenant.id, action: "security.pickup_authorized", entityId: ownChild.id } });
      const result = await confirmPickupPerson(principal, ownChild.id, pickupId);
      expect(result.success).toBe(true);
      const after = await db.auditLog.count({ where: { tenantId: tenant.id, action: "security.pickup_authorized", entityId: ownChild.id } });
      expect(after > before).toBe(true);
    });

    await testAsync("parent can create alternate pickup code with screenshot proof", async () => {
      const alt = await parentCreateAltPickup(parent, {
        studentId: ownChild.id,
        pickerName: "Otieno Test Picker",
        pickerPhone: "+254722333444",
        relationship: "Family friend",
        screenshotUrl: "/api/files/serve?key=test-alt-pickup.png",
        screenshotName: "test-alt-pickup.png",
        validHours: 12,
      });
      altId = alt.id;
      altCode = alt.code;
      expect(alt.code.startsWith("PK-")).toBe(true);
    });

    await testAsync("gate verifies alternate pickup code once", async () => {
      const verified = await verifyAltPickup(principal, altCode);
      expect(verified.success).toBe(true);
    });

    await testAsync("parent can remove permanent pickup person", async () => {
      const removed = await parentRemovePickupPerson(parent, pickupId);
      expect(removed.active).toBe(false);
    });

    await testAsync("parent can cancel a still-active alternate code", async () => {
      const alt = await parentCreateAltPickup(parent, { studentId: ownChild.id, pickerName: "Cancel Me Test", relationship: "Aunt", validHours: 12 });
      altId = alt.id;
      const cancelled = await parentCancelAltPickup(parent, alt.id);
      expect(cancelled.cancelled).toBe(true);
    });
  } finally {
    await db.pickupPerson.deleteMany({ where: { id: pickupId || "__none__" } });
    await db.altPickupAuthorization.deleteMany({ where: { OR: [{ id: altId || "__none__" }, { pickerName: { contains: "Test" } }] } });
    await db.auditLog.deleteMany({ where: { tenantId: tenant.id, OR: [{ action: { contains: "pickup" }, metadata: { contains: "Test" } }, { action: "security.pickup_authorized", entityId: ownChild.id }] } }).catch(() => {});
  }

  summary();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => db.$disconnect());
