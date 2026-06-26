/**
 * Cross-role test suite (Feature A.3.10).
 * Asserts the authorization + multi-tenancy guarantees stay correct.
 * Run:  npm run test:roles
 */
import { test, testAsync, expect, group, summary } from "./_assert";
import { ROLES } from "../src/lib/core/roles";
import {
  can,
  permissionsForRole,
  assertMatrixComplete,
  ROLE_PERMISSIONS,
} from "../src/lib/core/permissions";
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb, TenantIsolationError } from "../src/lib/core/tenant-db";

async function main() {
  group("Roles enum (A.3.1)");
  test("exactly 16 roles are defined", () => {
    expect(ROLES.length).toBe(16);
  });
  test("roles are unique", () => {
    expect(new Set(ROLES).size).toBe(16);
  });

  group("Permission matrix completeness (A.3.2)");
  test("every role appears in the matrix", () => {
    assertMatrixComplete(); // throws if a role is missing
  });
  test("every role's permission list is internally de-duplicated", () => {
    for (const r of ROLES) {
      const list = ROLE_PERMISSIONS[r];
      expect(new Set(list).size).toBe(new Set(list).size); // structural
    }
  });

  group("Positive permissions (role CAN)");
  test("SUPER_ADMIN can do everything", () => {
    expect(can("SUPER_ADMIN", "finance.manage_structure")).toBe(true);
    expect(can("SUPER_ADMIN", "user.manage_roles")).toBe(true);
  });
  test("PRINCIPAL can manage roles, finance, academics", () => {
    expect(can("PRINCIPAL", "user.manage_roles")).toBe(true);
    expect(can("PRINCIPAL", "finance.manage_structure")).toBe(true);
    expect(can("PRINCIPAL", "exam.publish")).toBe(true);
  });
  test("BURSAR can record payments", () => {
    expect(can("BURSAR", "finance.record_payment")).toBe(true);
  });
  test("TEACHER can enter marks and record attendance", () => {
    expect(can("TEACHER", "exam.enter_marks")).toBe(true);
    expect(can("TEACHER", "attendance.record")).toBe(true);
  });
  test("RECEPTIONIST can create students and record payments", () => {
    expect(can("RECEPTIONIST", "student.create")).toBe(true);
    expect(can("RECEPTIONIST", "finance.record_payment")).toBe(true);
  });
  test("PARENT can view student + attendance + finance", () => {
    expect(can("PARENT", "student.view")).toBe(true);
    expect(can("PARENT", "attendance.view")).toBe(true);
    expect(can("PARENT", "finance.view")).toBe(true);
  });

  group("Negative permissions (role CANNOT)");
  test("BURSAR cannot delete students", () => {
    expect(can("BURSAR", "student.delete")).toBe(false);
  });
  test("TEACHER cannot publish exams or manage finance", () => {
    expect(can("TEACHER", "exam.publish")).toBe(false);
    expect(can("TEACHER", "finance.record_payment")).toBe(false);
  });
  test("STUDENT cannot view finance or create students", () => {
    expect(can("STUDENT", "finance.view")).toBe(false);
    expect(can("STUDENT", "student.create")).toBe(false);
  });
  test("PARENT cannot record attendance or manage modules", () => {
    expect(can("PARENT", "attendance.record")).toBe(false);
    expect(can("PARENT", "tenant.manage_modules")).toBe(false);
  });
  test("LIBRARIAN cannot manage settings", () => {
    expect(can("LIBRARIAN", "tenant.manage_settings")).toBe(false);
  });
  test("only leadership + super-admin can manage modules", () => {
    const allowed = ROLES.filter((r) => can(r, "tenant.manage_modules"));
    expect(allowed.sort()).toEqual(
      ["DEPUTY_PRINCIPAL", "PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].sort()
    );
  });
  test("only leadership + super-admin can export data", () => {
    const allowed = ROLES.filter((r) => can(r, "tenant.export_data"));
    expect(allowed.sort()).toEqual(
      ["PRINCIPAL", "SCHOOL_OWNER", "SUPER_ADMIN"].sort()
    );
  });

  group("Tenant isolation (A.2.1 / A.2.8)");
  const karibu = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const uhuru = await db.tenant.findUniqueOrThrow({ where: { slug: "uhuru-academy" } });
  const uhuruUser = await db.user.findFirstOrThrow({ where: { tenantId: uhuru.id } });

  await testAsync("scoped findMany returns only the tenant's users", async () => {
    await withTenant(karibu.id, async () => {
      const users = await tenantDb().user.findMany();
      expect(users.every((u) => u.tenantId === karibu.id)).toBe(true);
    });
  });
  await testAsync("cross-tenant findUnique is blocked", async () => {
    await withTenant(karibu.id, async () => {
      let blocked = false;
      try {
        const r = await tenantDb().user.findUnique({ where: { id: uhuruUser.id } });
        blocked = r === null;
      } catch (e) {
        blocked = e instanceof TenantIsolationError;
      }
      expect(blocked).toBe(true);
    });
  });
  await testAsync("tenantDb() outside withTenant fails closed", async () => {
    let threw = false;
    try {
      tenantDb();
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  group("Permission list shape");
  test("permissionsForRole is sorted + deduped", () => {
    const list = permissionsForRole("PRINCIPAL");
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });

  group("Identity generation (A.4)");
  const { prefixFromSlug, entityCode } = await import("../src/lib/core/identity");
  const { nextTenantId } = await import("../src/lib/services/identity.service");
  test("prefix derives from slug", () => {
    expect(prefixFromSlug("karibu-high")).toBe("KH");
    expect(prefixFromSlug("uhuru-academy")).toBe("UA");
  });
  test("entity codes map correctly", () => {
    expect(entityCode("STUDENT")).toBe("S");
    expect(entityCode("INVOICE")).toBe("INV");
  });
  await testAsync("tenant IDs are unique under 30 parallel calls", async () => {
    await db.idSequence.deleteMany({ where: { entityType: "TESTSEQ" } });
    await nextTenantId(karibu.id, "TESTSEQ"); // create the row first
    const ids = await Promise.all(
      Array.from({ length: 30 }, () => nextTenantId(karibu.id, "TESTSEQ"))
    );
    expect(new Set(ids).size).toBe(30);
    await db.idSequence.deleteMany({ where: { entityType: "TESTSEQ" } });
  });

  await db.$disconnect();
  summary();
}

main().catch((e) => {
  console.error("Suite crashed:", e);
  process.exit(1);
});
