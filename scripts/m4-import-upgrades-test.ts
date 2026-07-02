/**
 * M.4 — Import Engine Upgrades: full-stack live test.
 *
 * Proves (real DB, real service calls, real assertions):
 *  1. Single-class-only import puts every row into the forced class,
 *     ignoring any Class column, and does NOT auto-create classes.
 *  2. Custom field columns create real StudentCustomField rows with the
 *     correct label/value per student.
 *  3. Legacy-admission-number (I.75) and duplicate-prevention (I.93)
 *     behaviour still passes unaffected by these changes.
 *  4. The importer has zero AI dependency (grep check).
 *
 * Cleans up everything it creates.
 */
import { execSync } from "node:child_process";
import { db } from "@/lib/db";
import { withTenant } from "@/lib/core/tenant-context";
import { previewImport, commitImport } from "@/lib/services/student-import.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

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
  console.log("M.4 import engine upgrades \u2014 full-stack test");
  const principalRaw = await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } });
  const user = asUser(principalRaw);
  const tenantId = user.tenantId;

  const createdStudentIds: string[] = [];
  const createdClassIds: string[] = [];
  let importIds: string[] = [];

  try {
    await withTenant(tenantId, async () => {
      const { tenantDb } = await import("@/lib/core/tenant-db");

      // --- Setup: a fixed class the single-class-only mode will target ---
      const classesBefore = await tenantDb().schoolClass.count();
      const targetClass = await tenantDb().schoolClass.create({
        data: { level: "Form 1", stream: "M4Test", curriculum: "CBC" } as never,
      });
      createdClassIds.push(targetClass.id);

      // ------------------------------------------------------------------
      // 1) Single-class-only import: rows carry a Class column that does
      //    NOT match the target class and does NOT exist anywhere \u2014 it
      //    must be completely ignored, no new class created.
      // ------------------------------------------------------------------
      const rows1 = [
        ["Full Name", "Gender", "Class", "Admission No"],
        ["Wanjiku Mary Njeri", "F", "Grade 9 Rainbow", "M4-ADM-1"],
        ["Otieno Brian Omondi", "M", "Nonexistent Stream Z", "M4-ADM-2"],
      ];
      const mapping1 = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "className" as const },
        { column: 3, field: "legacyAdmissionNo" as const },
      ];
      const preview1 = await previewImport(user, rows1, true, mapping1, targetClass.id);
      assert(preview1.targetClass?.id === targetClass.id, "preview reports the forced target class");
      assert(preview1.unknownClasses.length === 0, "preview does NOT flag any unknown classes in single-class-only mode");

      const commit1 = await commitImport(user, {
        source: "paste", rows: rows1, hasHeader: true, mapping: mapping1,
        seedRequirements: false, skipInvalid: true, targetClassId: targetClass.id,
      });
      importIds.push(commit1.importId);
      assert(commit1.created === 2, "both rows created despite bogus Class column text");

      const importedStudents = await tenantDb().student.findMany({
        where: { legacyAdmissionNo: { in: ["M4-ADM-1", "M4-ADM-2"] } },
      });
      createdStudentIds.push(...importedStudents.map((s) => s.id));
      assert(importedStudents.length === 2, "both students found in DB");
      assert(importedStudents.every((s) => s.classId === targetClass.id), "every student landed in the forced target class");

      const classesAfter = await tenantDb().schoolClass.count();
      assert(classesAfter === classesBefore + 1, "no new class was auto-created (only the one we made ourselves exists)");

      // ------------------------------------------------------------------
      // 2) Custom field columns: mapped field:"custom" with a customLabel
      //    must create real StudentCustomField rows, not touch `notes`.
      // ------------------------------------------------------------------
      const rows2 = [
        ["Full Name", "Gender", "Admission No", "House", "Sponsor"],
        ["Kiptoo Faith Chebet", "F", "M4-ADM-3", "Kilimanjaro", "Compassion International"],
      ];
      const mapping2 = [
        { column: 0, field: "fullName" as const },
        { column: 1, field: "gender" as const },
        { column: 2, field: "legacyAdmissionNo" as const },
        { column: 3, field: "custom" as const, customLabel: "House" },
        { column: 4, field: "custom" as const, customLabel: "Sponsor" },
      ];
      const preview2 = await previewImport(user, rows2, true, mapping2, targetClass.id);
      const sampleCustom = (preview2.sample[0] as any)._customFields as { label: string; value: string }[];
      assert(sampleCustom.length === 2, "preview shows 2 custom fields for the row");
      assert(sampleCustom.some((f) => f.label === "House" && f.value === "Kilimanjaro"), "preview custom field House=Kilimanjaro present");

      const commit2 = await commitImport(user, {
        source: "paste", rows: rows2, hasHeader: true, mapping: mapping2,
        seedRequirements: false, skipInvalid: true, targetClassId: targetClass.id,
      });
      importIds.push(commit2.importId);
      assert(commit2.created === 1, "custom-field row created");

      const kiptoo = await tenantDb().student.findFirstOrThrow({ where: { legacyAdmissionNo: "M4-ADM-3" } });
      createdStudentIds.push(kiptoo.id);
      assert(kiptoo.notes === null, "custom field values were NOT dumped into the notes field");

      const customFieldRows = await tenantDb().studentCustomField.findMany({ where: { studentId: kiptoo.id }, orderBy: { label: "asc" } });
      assert(customFieldRows.length === 2, "exactly 2 real StudentCustomField rows exist for this student");
      assert(customFieldRows.find((f) => f.label === "House")?.value === "Kilimanjaro", "House custom field value correct in DB");
      assert(customFieldRows.find((f) => f.label === "Sponsor")?.value === "Compassion International", "Sponsor custom field value correct in DB");

      // stamp check: StudentImport history row records the forced class
      const historyRow = await tenantDb().studentImport.findUniqueOrThrow({ where: { id: commit2.importId } });
      assert(historyRow.targetClassId === targetClass.id, "StudentImport history row stamped with the forced targetClassId");
    });

    // ------------------------------------------------------------------
    // 3) Regression: I.75 legacy admission + I.93 duplicate prevention
    //    scripts still pass unaffected (run them here directly for a
    //    single consolidated report; they are also run standalone).
    // ------------------------------------------------------------------
    console.log("  (re-running I.75 + I.93 regression scripts as sub-processes)");
    execSync("npx tsx scripts/i75-custom-admission-test.ts", { cwd: process.cwd(), stdio: "inherit" });
    execSync("npx tsx scripts/i93-duplicate-import-test.ts", { cwd: process.cwd(), stdio: "inherit" });
    console.log("  \u2713 I.75 custom admission numbers test still passes after M.4 changes");
    console.log("  \u2713 I.93 duplicate import prevention test still passes after M.4 changes");

    // ------------------------------------------------------------------
    // 4) No AI dependency in the STANDARD importer's actual logic (service +
    //    validation). The wizard UI is allowed a plain navigational LINK to
    //    the separate M.5 Bundi import page (checklist requirement: M.5 must
    //    be "a separate premium/manual-assist import path" — a cross-link is
    //    exactly how that separation is surfaced to the user), so the UI
    //    check only fails on an actual AI/vision provider reference, not the
    //    word "bundi" appearing in a `<Link href="/students/import/bundi">`.
    // ------------------------------------------------------------------
    const engineGrep = execSync(
      "grep -inE \"openai|anthropic|gemini|gpt-|ai\\.service|bundi\" src/lib/services/student-import.service.ts src/lib/validations/student-import.ts || true",
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    assert(engineGrep.trim() === "", "standard importer's service+validation logic has zero AI/Bundi dependency (grep found nothing)");

    const uiGrep = execSync(
      "grep -inE \"openai|anthropic|gemini|gpt-|ai\\.service\" src/components/students/import-wizard.tsx || true",
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    assert(uiGrep.trim() === "", "standard importer's UI has zero actual AI-provider dependency (a plain link to the separate M.5 Bundi page is fine)");

    const linkGrep = execSync(
      "grep -inE \"students/import/bundi\" src/components/students/import-wizard.tsx || true",
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    assert(linkGrep.trim() !== "", "the standard importer surfaces a clear navigational link to the SEPARATE M.5 Bundi path, never merging the two engines");

    console.log("\n\u2705 M.4 import engine upgrades test passed");
  } finally {
    // cleanup
    await withTenant(tenantId, async () => {
      const { tenantDb } = await import("@/lib/core/tenant-db");
      if (createdStudentIds.length) {
        await tenantDb().studentCustomField.deleteMany({ where: { studentId: { in: createdStudentIds } } });
        await tenantDb().studentGuardian.deleteMany({ where: { studentId: { in: createdStudentIds } } });
        await tenantDb().student.deleteMany({ where: { id: { in: createdStudentIds } } });
      }
      if (importIds.length) await tenantDb().studentImport.deleteMany({ where: { id: { in: importIds } } });
      if (createdClassIds.length) await tenantDb().schoolClass.deleteMany({ where: { id: { in: createdClassIds } } });
    });
    console.log("  cleanup \u2713 (test rows removed)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
