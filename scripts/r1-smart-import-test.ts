/**
 * R.1 — Smart create-or-update import, full-stack test.
 *
 * Founder's real complaint (verbatim, paraphrased): re-importing a file with
 * the same admission number/parent phone/etc. should never create a
 * duplicate student — it should UPDATE the existing one, only filling in
 * NEW information, and genuine conflicts (two different values for the same
 * field) must be reported back for a human decision, never silently
 * overwritten. Also: students who share a name should be told apart by
 * their guardian's phone number, an opening balance import must create a
 * real invoice without ever touching money already recorded as paid, and
 * none of this may weaken the existing strict duplicate-rejection mode.
 */
import { db } from "../src/lib/db";
import { withTenant } from "../src/lib/core/tenant-context";
import { tenantDb } from "../src/lib/core/tenant-db";
import { previewImport, commitImport, matchExistingStudent, diffAgainstExisting } from "../src/lib/services/student-import.service";
import type { SessionUser } from "../src/lib/core/session";
import type { Role } from "../src/lib/core/roles";

function asUser(u: any): SessionUser {
  return {
    id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName,
    phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  \u2713 ${message}`);
}

async function main() {
  console.log("R.1 Smart create-or-update import — full-stack test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const tenantId = user.tenantId;

  const createdStudentIds: string[] = [];
  const createdGuardianPhones = ["+254799000101", "+254799000102", "+254799000103"];

  try {
    await withTenant(tenantId, async () => {
      // ---- Round 1: a brand-new student, minimal info ----
      const rows1 = [
        ["Full Name", "Gender", "Admission No", "Class"],
        ["Zawadi Wanjiku Kariuki", "F", "R1-ADM-001", "Form 2 East"],
      ];
      const mapping1 = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "legacyAdmissionNo" as const },
        { column: 3, field: "className" as const },
      ];
      const commit1 = await commitImport(user, { source: "paste", rows: rows1, hasHeader: true, mapping: mapping1, seedRequirements: false, skipInvalid: true });
      assert(commit1.created === 1 && commit1.updated === 0, "round 1: a genuinely new student is created, not matched to anything");
      const zawadi = await tenantDb().student.findFirstOrThrow({ where: { legacyAdmissionNo: "R1-ADM-001" } });
      createdStudentIds.push(zawadi.id);
      assert(zawadi.upiNumber === null && zawadi.notes === null, "round 1: student starts with genuinely blank optional fields");

      // ---- Round 2: SAME admission number, NEW info only (UPI, guardian, notes) ----
      const rows2 = [
        ["Full Name", "Gender", "Admission No", "Class", "UPI", "Guardian Name", "Guardian Phone", "Notes"],
        ["Zawadi Wanjiku Kariuki", "F", "R1-ADM-001", "Form 2 East", "UPI-R1-001", "Susan Kariuki", "0799000101", "Allergic to peanuts"],
      ];
      const mapping2 = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "legacyAdmissionNo" as const },
        { column: 3, field: "className" as const },
        { column: 4, field: "upiNumber" as const },
        { column: 5, field: "guardianName" as const },
        { column: 6, field: "guardianPhone" as const },
        { column: 7, field: "notes" as const },
      ];
      const preview2 = await previewImport(user, rows2, true, mapping2, undefined, true);
      assert(preview2.matchedRows.length === 1 && preview2.matchedRows[0].matchedOn === "admissionNo", "round 2 preview: real match found by admission number, not treated as a duplicate error");
      assert(preview2.matchedRows[0].fillable.includes("upiNumber"), "round 2 preview: UPI correctly identified as a fillable NEW field (was blank)");
      assert(preview2.matchedRows[0].conflicts.length === 0, "round 2 preview: no real conflicts (nothing pre-existing disagrees)");
      assert(preview2.issues.length === 0, "round 2 preview: no duplicate-style rejection issues raised");

      const commit2 = await commitImport(user, { source: "paste", rows: rows2, hasHeader: true, mapping: mapping2, seedRequirements: false, skipInvalid: true, updateExisting: true });
      assert(commit2.created === 0 && commit2.updated === 1, "round 2 commit: the SAME student is updated, zero new students created");

      const zawadiAfter = await tenantDb().student.findUniqueOrThrow({
        where: { id: zawadi.id },
        include: { guardians: { include: { guardian: true } } },
      });
      assert(zawadiAfter.upiNumber === "UPI-R1-001", "round 2 result: UPI genuinely filled in on the SAME real student row");
      assert(zawadiAfter.notes === "Allergic to peanuts", "round 2 result: notes genuinely filled in");
      assert(zawadiAfter.guardians.length === 1 && zawadiAfter.guardians[0].guardian.phone === "+254799000101", "round 2 result: a real guardian was linked from the new info");

      const totalWithThisAdm = await tenantDb().student.count({ where: { legacyAdmissionNo: "R1-ADM-001" } });
      assert(totalWithThisAdm === 1, "no duplicate student was created for the same admission number across 2 import runs");

      // ---- Round 3: re-run the EXACT same file again — must be a safe no-op ----
      const commit3 = await commitImport(user, { source: "paste", rows: rows2, hasHeader: true, mapping: mapping2, seedRequirements: false, skipInvalid: true, updateExisting: true });
      assert(commit3.created === 0, "round 3 (identical re-import): still zero new students created");
      const guardianLinksAfterRerun = await tenantDb().studentGuardian.count({ where: { studentId: zawadi.id } });
      assert(guardianLinksAfterRerun === 1, "round 3: re-importing identical data does not create a duplicate guardian link");

      // ---- Round 4: a genuine CONFLICT (different UPI) must be reported, not silently overwritten ----
      const rows4 = [
        ["Full Name", "Gender", "Admission No", "UPI"],
        ["Zawadi Wanjiku Kariuki", "F", "R1-ADM-001", "UPI-DIFFERENT-999"],
      ];
      const mapping4 = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "legacyAdmissionNo" as const },
        { column: 3, field: "upiNumber" as const },
      ];
      const preview4 = await previewImport(user, rows4, true, mapping4, undefined, true);
      assert(preview4.matchedRows[0].conflicts.some((c) => c.field === "upiNumber"), "round 4 preview: a genuinely different UPI value is flagged as a real conflict");
      const commit4 = await commitImport(user, { source: "paste", rows: rows4, hasHeader: true, mapping: mapping4, seedRequirements: false, skipInvalid: true, updateExisting: true });
      assert(commit4.updated === 0 && commit4.failed.length === 1, "round 4 commit: an unconfirmed conflict is NOT applied — reported as a failed row instead");
      const zawadiStillOriginal = await tenantDb().student.findUniqueOrThrow({ where: { id: zawadi.id } });
      assert(zawadiStillOriginal.upiNumber === "UPI-R1-001", "round 4 result: the ORIGINAL UPI is untouched — never silently overwritten");

      // ---- Round 5: the SAME conflict, but explicitly confirmed by the school ----
      const commit5 = await commitImport(user, { source: "paste", rows: rows4, hasHeader: true, mapping: mapping4, seedRequirements: false, skipInvalid: true, updateExisting: true, confirmedConflictRows: [2] });
      assert(commit5.updated === 1, "round 5: an EXPLICITLY confirmed conflict is now genuinely applied");
      const zawadiOverwritten = await tenantDb().student.findUniqueOrThrow({ where: { id: zawadi.id } });
      assert(zawadiOverwritten.upiNumber === "UPI-DIFFERENT-999", "round 5 result: the confirmed new UPI value is now genuinely on the real record");

      // ---- Same-name disambiguation via guardian phone (the founder's exact example) ----
      const rowsTwins = [
        ["Full Name", "Gender", "Guardian Name", "Guardian Phone"],
        ["Brian Otieno Omondi", "M", "Alice Omondi", "0799000102"],
        ["Brian Otieno Omondi", "M", "Faith Mwangi", "0799000103"],
      ];
      const mappingTwins = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "guardianName" as const },
        { column: 3, field: "guardianPhone" as const },
      ];
      const commitTwins = await commitImport(user, { source: "paste", rows: rowsTwins, hasHeader: true, mapping: mappingTwins, seedRequirements: false, skipInvalid: true, updateExisting: true });
      assert(commitTwins.created === 2, "two genuinely different real students who share a name are both created (no false match on name alone)");
      const twins = await tenantDb().student.findMany({ where: { firstName: "Brian", lastName: "Omondi" }, include: { guardians: { include: { guardian: true } } } });
      for (const t of twins) createdStudentIds.push(t.id);
      assert(twins.length === 2, "both same-named students genuinely exist as separate real records");

      // Now re-import ONE of the twins with more info + THEIR guardian's phone
      // — must match the RIGHT one via the guardian-phone signal, never the other.
      const rowsTwinUpdate = [
        ["Full Name", "Gender", "Guardian Phone", "Notes"],
        ["Brian Otieno Omondi", "M", "0799000103", "Needs extra time in exams"],
      ];
      const mappingTwinUpdate = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "guardianPhone" as const },
        { column: 3, field: "notes" as const },
      ];
      const previewTwinUpdate = await previewImport(user, rowsTwinUpdate, true, mappingTwinUpdate, undefined, true);
      assert(previewTwinUpdate.matchedRows.length === 1 && previewTwinUpdate.matchedRows[0].matchedOn === "name+guardianPhone", "same-name disambiguation: the real guardian-phone signal correctly identifies WHICH of the two same-named students this row is about");
      await commitImport(user, { source: "paste", rows: rowsTwinUpdate, hasHeader: true, mapping: mappingTwinUpdate, seedRequirements: false, skipInvalid: true, updateExisting: true });
      const rightTwin = twins.find((t) => t.guardians.some((g) => g.guardian.phone === "+254799000103"));
      const wrongTwin = twins.find((t) => t.guardians.some((g) => g.guardian.phone === "+254799000102"));
      const rightTwinAfter = await tenantDb().student.findUniqueOrThrow({ where: { id: rightTwin!.id } });
      const wrongTwinAfter = await tenantDb().student.findUniqueOrThrow({ where: { id: wrongTwin!.id } });
      assert(rightTwinAfter.notes === "Needs extra time in exams", "the CORRECT same-named student (matched by their real guardian's phone) received the update");
      assert(wrongTwinAfter.notes === null, "the OTHER same-named student was correctly left untouched");

      // ---- Opening balance import creates a real invoice, never edits an existing one ----
      const rowsBalance = [
        ["Full Name", "Gender", "Admission No", "Opening Balance"],
        ["Zawadi Wanjiku Kariuki", "F", "R1-ADM-001", "8000"],
      ];
      const mappingBalance = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "legacyAdmissionNo" as const },
        { column: 3, field: "openingBalanceKes" as const },
      ];
      await commitImport(user, { source: "paste", rows: rowsBalance, hasHeader: true, mapping: mappingBalance, seedRequirements: false, skipInvalid: true, updateExisting: true });
      const arrears = await tenantDb().invoice.findFirst({ where: { studentId: zawadi.id, kind: "ARREARS", description: { contains: "Imported opening balance" } } });
      assert(!!arrears && arrears.totalKes === 8000 && arrears.paidKes === 0, "a real, standalone ARREARS invoice was created for the imported opening balance");

      // Re-import the SAME balance again — must not double-bill.
      await commitImport(user, { source: "paste", rows: rowsBalance, hasHeader: true, mapping: mappingBalance, seedRequirements: false, skipInvalid: true, updateExisting: true });
      const arrearsCount = await tenantDb().invoice.count({ where: { studentId: zawadi.id, kind: "ARREARS", description: { contains: "Imported opening balance" } } });
      assert(arrearsCount === 1, "re-importing the identical opening balance does NOT create a second invoice (no double-billing a family)");

      // ---- Explicitly disabling updateExisting restores the old strict-reject behavior ----
      let strictRejected = false;
      try {
        await commitImport(user, { source: "paste", rows: rows2, hasHeader: true, mapping: mapping2, seedRequirements: false, skipInvalid: true, updateExisting: false });
      } catch (e) {
        strictRejected = e instanceof Error && /already exists|DUPLICATE|Import denied/i.test(e.message);
      }
      assert(strictRejected, "updateExisting:false explicitly restores the original strict duplicate-rejection behavior (never silently weakened)");
    });

    console.log("\n\u2705 R.1 Smart create-or-update import test passed");
  } finally {
    await withTenant(tenantId, async () => {
      const tdb = tenantDb();
      for (const id of createdStudentIds) {
        await tdb.invoice.deleteMany({ where: { studentId: id } }).catch(() => {});
        await tdb.studentCustomField.deleteMany({ where: { studentId: id } }).catch(() => {});
        await tdb.studentGuardian.deleteMany({ where: { studentId: id } }).catch(() => {});
        await db.student.deleteMany({ where: { id } }).catch(() => {}); // hard delete: genuinely throwaway test rows, not a real soft-delete case
      }
      await db.guardian.deleteMany({ where: { phone: { in: createdGuardianPhones } } }).catch(() => {});
    });
    console.log("  cleanup \u2713 (test students, guardians, invoices removed; StudentImport history rows kept, same as pre-existing import-test.ts convention — an immutable audit trail)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
