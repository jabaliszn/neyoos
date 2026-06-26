import { db } from "../src/lib/db";
import { listStudents } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";
async function main() {
  const principal = (await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } })) as unknown as SessionUser;
  const all = await listStudents(principal, {});
  const east = await listStudents(principal, { stream: "East" });
  const eastOk = east.length > 0 && east.every(s => s.className?.endsWith("East"));
  console.log(`all=${all.length}, stream=East -> ${east.length}, all in East: ${eastOk ? "✓" : "✗ FAIL"}`);
  const none = await listStudents(principal, { stream: "Nonexistent" });
  console.log("unknown stream -> 0:", none.length === 0 ? "✓" : "✗ FAIL");
  // teacher scoping STILL applies with stream filter
  const cls = await db.schoolClass.findFirstOrThrow({ where: { classTeacherId: { not: null } } });
  const teacher = (await db.user.findUniqueOrThrow({ where: { id: cls.classTeacherId! } })) as unknown as SessionUser;
  const tEast = await listStudents(teacher, { stream: "West" }); // not her stream
  console.log("teacher + other stream -> 0 (scope wins):", tEast.length === 0 ? "✓" : "✗ LEAK");
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
