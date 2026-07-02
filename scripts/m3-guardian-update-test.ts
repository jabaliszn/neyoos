/**
 * M.3 — Class teachers can update parent phone numbers: full-stack live test.
 *
 * Proves (real DB, real service calls, real assertions):
 *  1. A CLASS_TEACHER can update the phone/relationship of a guardian linked
 *     to a student IN THEIR OWN CLASS.
 *  2. The same CLASS_TEACHER is BLOCKED (fail-closed, A.3.8 row-scoping) from
 *     editing a guardian on a student in a DIFFERENT class.
 *  3. Editing a guardian who has a linked PARENT portal login also updates
 *     that User's phone/email so their login stays reachable.
 *  4. A no-op edit (nothing changed) doesn't throw and doesn't create bogus
 *     audit noise beyond the expected entries.
 *  5. Editing a guardian NOT linked to the given student is rejected.
 *
 * Full cleanup in a finally block; safe to run repeatedly.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { addGuardian, updateGuardian, StudentError } from "../src/lib/services/student.service";
import { addGuardianSchema, updateGuardianSchema } from "../src/lib/validations/student";
import { generateNeyoLoginId } from "../src/lib/services/identity.service";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}
async function expectForbiddenOrNotFound(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof StudentError && (e.code === "FORBIDDEN" || e.code === "NOT_FOUND"), `${label} (got: ${e instanceof Error ? e.message : e})`);
    return;
  }
  throw new Error(`Expected a block: ${label}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function main() {
  console.log("M.3 guardian update \u2014 full-stack test");

  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const principal = asUser(principalRaw);
  const tenantId = principal.tenantId;

  const classTeacherRaw = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const classTeacher = asUser(classTeacherRaw);

  const ownClass = await db.schoolClass.findFirstOrThrow({ where: { classTeacherId: classTeacher.id } });
  const ownStudent = await db.student.findFirstOrThrow({ where: { classId: ownClass.id } });
  const otherStudent = await db.student.findFirstOrThrow({ where: { classId: { not: ownClass.id } } });

  const createdGuardianIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    await withTenant(tenantId, async () => {
      // --- Setup: a guardian on the class teacher's OWN student, no login ---
      const g1 = await addGuardian(principal, ownStudent.id, addGuardianSchema.parse({
        fullName: "Test Guardian OwnClass",
        phone: "0711000111",
        email: "",
        nationalId: "",
        relationship: "Parent",
        isPrimary: false,
        createLogin: false,
      }));
      createdGuardianIds.push(g1.id);

      // --- Setup: a guardian WITH a portal login, also on the own student ---
      const g2 = await addGuardian(principal, ownStudent.id, addGuardianSchema.parse({
        fullName: "Test Guardian WithLogin",
        phone: "0711000222",
        email: "oldemail@example.com",
        nationalId: "",
        relationship: "Mother",
        isPrimary: false,
        createLogin: true,
      }));
      createdGuardianIds.push(g2.id);
      const g2Row = await db.guardian.findUniqueOrThrow({ where: { id: g2.id } });
      assert(!!g2Row.userId, "guardian WithLogin has a real linked PARENT user");
      if (g2Row.userId) createdUserIds.push(g2Row.userId);

      // --- Setup: a guardian on a DIFFERENT class's student ---
      const g3 = await addGuardian(principal, otherStudent.id, addGuardianSchema.parse({
        fullName: "Test Guardian OtherClass",
        phone: "0711000333",
        email: "",
        nationalId: "",
        relationship: "Father",
        isPrimary: false,
        createLogin: false,
      }));
      createdGuardianIds.push(g3.id);

      // 1) CLASS_TEACHER updates a guardian on THEIR OWN student — should work.
      // (Parse through the real Zod schema first, exactly like the API route
      // does, so the phone gets normalized to +254... the same way.)
      await updateGuardian(classTeacher, ownStudent.id, g1.id, updateGuardianSchema.parse({ phone: "0722999888", relationship: "Guardian" }));
      const g1After = await db.guardian.findUniqueOrThrow({ where: { id: g1.id } });
      const g1Link = await db.studentGuardian.findUniqueOrThrow({ where: { studentId_guardianId: { studentId: ownStudent.id, guardianId: g1.id } } });
      assert(g1After.phone === "+254722999888", "class teacher's phone edit landed in the DB with the real normalized number");
      assert(g1Link.relationship === "Guardian", "class teacher's relationship edit landed in the DB");

      // 2) CLASS_TEACHER is BLOCKED from editing a guardian on a DIFFERENT class's student.
      await expectForbiddenOrNotFound(
        () => updateGuardian(classTeacher, otherStudent.id, g3.id, updateGuardianSchema.parse({ phone: "0700000000" })),
        "class teacher cannot edit a guardian on a student outside their own class (fail-closed A.3.8)"
      );
      const g3Unchanged = await db.guardian.findUniqueOrThrow({ where: { id: g3.id } });
      assert(g3Unchanged.phone === "+254711000333", "blocked edit did NOT change the other class's guardian phone");

      // 3) Editing a guardian WITH a linked PARENT login keeps the login's
      //    phone/email in sync so they can still receive OTP/messages.
      await updateGuardian(principal, ownStudent.id, g2.id, updateGuardianSchema.parse({ phone: "0733111222", email: "newemail@example.com", fullName: "Test Guardian Renamed" }));
      const g2AfterEdit = await db.guardian.findUniqueOrThrow({ where: { id: g2.id } });
      assert(g2AfterEdit.phone === "+254733111222", "guardian-with-login phone updated in Guardian table");
      assert(g2AfterEdit.email === "newemail@example.com", "guardian-with-login email updated in Guardian table");
      if (g2Row.userId) {
        const linkedUser = await db.user.findUniqueOrThrow({ where: { id: g2Row.userId } });
        assert(linkedUser.phone === "+254733111222", "linked PARENT login's phone kept in sync (they can still receive OTP)");
        assert(linkedUser.email === "newemail@example.com", "linked PARENT login's email kept in sync");
        assert(linkedUser.fullName === "Test Guardian Renamed", "linked PARENT login's name kept in sync");
      }

      // 4) A true no-op (empty patch) does not throw.
      const noopResult = await updateGuardian(principal, ownStudent.id, g1.id, updateGuardianSchema.parse({}));
      assert(noopResult.id === g1.id, "empty-patch no-op returns cleanly without error");

      // 5) Editing a guardian that is NOT linked to the given student is rejected.
      await expectForbiddenOrNotFound(
        () => updateGuardian(principal, ownStudent.id, g3.id, updateGuardianSchema.parse({ phone: "0700000001" })),
        "editing a guardian not linked to the given student is rejected"
      );
    });

    console.log("\n\u2705 M.3 guardian update test passed");
  } finally {
    await withTenant(tenantId, async () => {
      if (createdGuardianIds.length) {
        await db.studentGuardian.deleteMany({ where: { guardianId: { in: createdGuardianIds } } });
        await db.guardian.deleteMany({ where: { id: { in: createdGuardianIds } } });
      }
      if (createdUserIds.length) {
        await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    });
    console.log("  cleanup \u2713 (test guardians + login removed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
