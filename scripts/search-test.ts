/** B.1 search gaps — live tests incl. row-scoping in global search. */
import { db } from "../src/lib/db";
import { search } from "../src/lib/services/search.service";
import { listStudents } from "../src/lib/services/student.service";
import type { SessionUser } from "../src/lib/core/session";

async function asUser(email: string) {
  return (await db.user.findFirstOrThrow({ where: { email } })) as unknown as SessionUser;
}

async function main() {
  const principal = await asUser("principal@karibuhigh.ac.ke");
  const parent = await asUser("parent@karibuhigh.ac.ke");
  const teacher = await asUser("f.chebet@karibuhigh.ac.ke");
  const librarian = await asUser("librarian@karibuhigh.ac.ke").catch(() => null);

  // 1) guardian-phone search in the students list
  const g = await db.guardian.findFirstOrThrow({ where: { tenantId: principal.tenantId, phone: { not: "" } }, include: { students: { include: { student: true } } } });
  const childName = g.students[0]?.student.firstName;
  const local = "0" + g.phone.slice(4); // +2547... -> 07...
  for (const probe of [g.phone, local, g.phone.slice(1), local.slice(0, 7)]) {
    const r = await listStudents(principal, { q: probe });
    const hit = r.some(s => s.name.includes(childName ?? "@@"));
    console.log(`list q="${probe}" -> ${r.length} hit(s), includes child: ${hit ? "✓" : "✗ FAIL"}`);
  }
  // name search must still work
  const byName = await listStudents(principal, { q: "Achieng" });
  console.log("name search still works:", byName.length > 0 ? "✓" : "✗ FAIL");

  // 2) global ⌘K search returns students
  const hits = await search(principal.tenantId, "Achieng", principal);
  const studentHits = hits.filter(h => h.type === "student");
  console.log("⌘K 'Achieng' student hits:", studentHits.length, studentHits[0]?.subtitle ?? "", "->", studentHits[0]?.href ?? "");
  const phoneHits = await search(principal.tenantId, local, principal);
  console.log("⌘K phone search student hit:", phoneHits.some(h => h.type === "student") ? "✓" : "✗ FAIL");

  // 3) ROW-SCOPING IN SEARCH (security)
  const all = await listStudents(principal, {});
  const parentKids = await listStudents(parent, {});
  const notMyKid = all.find(s => !parentKids.some(p => p.id === s.id))!;
  const parentSearch = await search(parent.tenantId, notMyKid.name.split(" ")[0], parent);
  console.log("PARENT searching another child:", parentSearch.some(h => h.type === "student" && h.id === notMyKid.id) ? "✗ LEAK!" : "✓ blocked");
  const teacherKids = await listStudents(teacher, {});
  const notHerClass = all.find(s => !teacherKids.some(t => t.id === s.id))!;
  const teacherSearch = await search(teacher.tenantId, notHerClass.name.split(" ")[0], teacher);
  console.log("TEACHER searching outside own class:", teacherSearch.some(h => h.type === "student" && h.id === notHerClass.id) ? "✗ LEAK!" : "✓ blocked");

  // 4) tenant isolation unchanged: Uhuru principal finds no Karibu students
  const uhuru = await asUser("principal@uhuruacademy.ac.ke");
  const cross = await search(uhuru.tenantId, "Achieng", uhuru);
  console.log("cross-tenant student search:", cross.filter(h => h.type === "student").length === 0 ? "✓ isolated" : "✗ LEAK!");

  // 5) no-user call (defensive): students simply not included
  const noUser = await search(principal.tenantId, "Achieng");
  console.log("search without user -> no student hits (gated):", noUser.every(h => h.type !== "student") ? "✓" : "✗");
  void librarian;
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
