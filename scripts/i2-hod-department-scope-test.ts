/**
 * I.2 — HOD appointment + department scoping regression test.
 * Verifies that Department Heads are appointed only by principal/owner and that
 * an HOD can manage only their assigned department/subjects.
 */
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import type { SessionUser } from "@/lib/core/session";
import { group, testAsync, expect, summary } from "./_assert";
import {
  listDepartments,
  listSubjects,
  createDepartment,
  updateDepartment,
  setSlot,
} from "@/lib/services/academics.service";

function asSessionUser(user: any): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    secondaryRole: user.secondaryRole,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    language: user.language ?? "en",
    neyoLoginId: user.neyoLoginId,
    viewAsReadOnly: false,
  } as SessionUser;
}

async function expectForbidden(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as any).code === "FORBIDDEN" || /HOD|reserved|Principal|department/i.test((e as Error).message)) return;
    throw e;
  }
  throw new Error("expected FORBIDDEN, but action succeeded");
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
  const deputyRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
  const hodRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "p.njoroge@karibuhigh.ac.ke" } });

  const principal = asSessionUser(principalRow);
  const deputy = asSessionUser(deputyRow);
  const hod = asSessionUser({ ...hodRow, role: "HOD" });

  const originalHodRole = hodRow.role;
  const originalSecondary = hodRow.secondaryRole;

  try {
    await withTenant(tenant.id, async () => {
      await db.user.update({ where: { id: hodRow.id }, data: { role: "HOD", secondaryRole: null } });

      let sciences = await db.department.findFirst({ where: { tenantId: tenant.id, name: "Sciences" } });
      if (!sciences) sciences = await db.department.create({ data: { tenantId: tenant.id, name: "Sciences" } });
      let languages = await db.department.findFirst({ where: { tenantId: tenant.id, name: "Languages" } });
      if (!languages) languages = await db.department.create({ data: { tenantId: tenant.id, name: "Languages" } });

      await db.department.update({ where: { id: sciences.id }, data: { hodId: hod.id } });
      await db.department.update({ where: { id: languages.id }, data: { hodId: null } });

      const math = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "MAT" } });
      const english = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "ENG" } });
      await db.subject.update({ where: { id: math.id }, data: { departmentId: sciences.id } });
      await db.subject.update({ where: { id: english.id }, data: { departmentId: languages.id } });

      const form2 = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 2" } });

      group("I.2 HOD appointment + department scope");

      await testAsync("principal can appoint a department head", async () => {
        const updated = await updateDepartment(principal, sciences.id, { hodId: hod.id });
        expect(updated.hodId).toBe(hod.id);
      });

      await testAsync("deputy cannot appoint or change a department head", async () => {
        await expectForbidden(() => updateDepartment(deputy, sciences.id, { hodId: deputy.id }));
      });

      await testAsync("HOD sees only assigned department", async () => {
        const depts = await listDepartments(hod);
        expect(depts.length).toBe(1);
        expect(depts[0].id).toBe(sciences.id);
      });

      await testAsync("HOD sees only own-department subjects", async () => {
        const subjects = await listSubjects(hod);
        expect(subjects.some((s) => s.code === "MAT")).toBeTruthy();
        expect(subjects.some((s) => s.code === "ENG")).toBeFalsy();
      });

      await testAsync("HOD cannot create a new department", async () => {
        await expectForbidden(() => createDepartment(hod, { name: "I.2 Test Department" }));
      });

      await testAsync("HOD cannot manage another department", async () => {
        await expectForbidden(() => updateDepartment(hod, languages.id, { name: "Languages Updated" }));
      });

      await testAsync("HOD cannot steal another department's subject", async () => {
        await expectForbidden(() => updateDepartment(hod, sciences.id, { subjectIds: [math.id, english.id] }));
      });

      await testAsync("HOD can update own department subject mapping", async () => {
        const updated = await updateDepartment(hod, sciences.id, { name: "Sciences", subjectIds: [math.id] });
        expect(updated.id).toBe(sciences.id);
      });

      await testAsync("HOD cannot timetable a subject outside own department", async () => {
        await expectForbidden(() => setSlot(hod, { classId: form2.id, subjectId: english.id, dayOfWeek: 1, period: 8 }));
      });

      await testAsync("HOD can timetable own-department subject", async () => {
        const row = await setSlot(hod, { classId: form2.id, subjectId: math.id, dayOfWeek: 1, period: 8 });
        expect(row.subjectId).toBe(math.id);
      });
    });
  } finally {
    await db.user.update({ where: { id: hodRow.id }, data: { role: originalHodRole, secondaryRole: originalSecondary } });
  }

  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
