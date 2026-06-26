/** B.1 audit: live row-scoping + CRUD checks against the real dev DB. */
import { db } from "../src/lib/db";
import { listStudents, getStudent, studentStats } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string): Promise<SessionUser> {
  const u = await db.user.findFirst({ where: { email } });
  if (!u) throw new Error("no user " + email);
  return u as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");
  // find the class teacher user (assigned to a class in seed)
  const cls = await db.schoolClass.findFirst({ where: { classTeacherId: { not: null } } });
  const teacherUser = cls?.classTeacherId ? await db.user.findUnique({ where: { id: cls.classTeacherId } }) : null;
  console.log("class w/ teacher:", cls?.level, cls?.stream, "→", teacherUser?.email);

  const pAll = await listStudents(principal, {});
  console.log("PRINCIPAL sees:", pAll.length, "students");

  if (cls && teacherUser) {
    const t = teacherUser as unknown as SessionUser;
    const tList = await listStudents(t, {});
    console.log(`TEACHER (${t.email}) sees:`, tList.length, tList.map(s => s.className).join(", "));
    const wrong = tList.filter(s => s.className !== `${cls.level} ${cls.stream ?? ""}`.trim());
    console.log("  teacher leakage outside own class:", wrong.length === 0 ? "NONE ✓" : "LEAK ✗ " + wrong.length);
    // filter must not widen scope
    const widened = await listStudents(t, { q: "a" });
    console.log("  filter cannot widen:", widened.every(s => tList.some(x => x.id === s.id)) ? "OK ✓" : "WIDENED ✗");
  }

  const parList = await listStudents(parent, {});
  console.log("PARENT sees:", parList.length, "student(s):", parList.map(s => s.name).join(", "));
  // parent tries to read another student directly
  const other = pAll.find(s => !parList.some(p => p.id === s.id));
  if (other) {
    try { await getStudent(parent, other.id); console.log("  parent direct-read other child: ALLOWED ✗ FAIL"); }
    catch { console.log("  parent direct-read other child: BLOCKED ✓"); }
  }
  const stats = await studentStats(principal);
  console.log("stats:", JSON.stringify(stats));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
