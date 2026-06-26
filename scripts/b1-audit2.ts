/** B.1 audit part 2: edit audit-trail + soft-delete/recycle. */
import { db } from "../src/lib/db";
import { updateStudent, deleteStudent, listStudents } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const all = await listStudents(principal, {});
  const target = all[all.length - 1];

  // 1) edit w/ audit trail
  const before = await db.auditLog.count({ where: { action: "student.update" } });
  await updateStudent(principal, target.id, { middleName: "AuditTest" });
  const after = await db.auditLog.count({ where: { action: "student.update" } });
  console.log("edit audit row created:", after === before + 1 ? "✓" : "✗ FAIL");
  const log = await db.auditLog.findFirst({ where: { action: "student.update" }, orderBy: { createdAt: "desc" } });
  console.log("  diff recorded:", (log?.metadata ?? "").includes("middleName") ? "✓" : "✗", (log?.metadata ?? "").slice(0, 100));
  await updateStudent(principal, target.id, { middleName: "" }); // revert

  // 2) soft-delete -> hidden -> restore
  await deleteStudent(principal, target.id);
  const raw = await db.student.findUnique({ where: { id: target.id } });
  console.log("soft-delete sets deletedAt (data kept):", raw?.deletedAt ? "✓" : "✗ FAIL");
  const visible = await listStudents(principal, {});
  console.log("hidden from list:", visible.some(s => s.id === target.id) ? "✗ FAIL" : "✓");
  await db.student.update({ where: { id: target.id }, data: { deletedAt: null, deletedById: null } }); // restore
  const back = await listStudents(principal, {});
  console.log("restored:", back.some(s => s.id === target.id) ? "✓" : "✗ FAIL");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
