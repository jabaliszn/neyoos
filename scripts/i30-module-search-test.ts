import { db } from "@/lib/db";
import { search } from "@/lib/services/search.service";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";

function asUser(u: any): SessionUser {
  return { id: u.id, tenantId: u.tenantId, neyoLoginId: u.neyoLoginId, fullName: u.fullName, phone: u.phone, email: u.email, role: u.role as Role, secondaryRole: u.secondaryRole as Role | null, language: u.language ?? "en" };
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("I.30 module search test");
  const principal = asUser(await db.user.findFirstOrThrow({ where: { email: "principal@karibuhigh.ac.ke" } }));
  const teacher = asUser(await db.user.findFirstOrThrow({ where: { email: "p.njoroge@karibuhigh.ac.ke" } }));

  const transport = await search(principal.tenantId, "transport", principal);
  assert(transport.some((h) => h.type === "module" && h.href === "/transport"), "principal search finds Transport module");

  const finance = await search(principal.tenantId, "finance", principal);
  assert(finance.some((h) => h.type === "module" && h.href === "/finance"), "principal search finds Finance module");

  const library = await search(principal.tenantId, "books", principal);
  assert(library.some((h) => h.type === "module" && h.href === "/library"), "module keywords find Library from books query");

  const teacherFinance = await search(teacher.tenantId, "finance", teacher);
  assert(!teacherFinance.some((h) => h.type === "module" && h.href === "/finance"), "teacher search does not show Finance module without permission");

  console.log("\n✅ I.30 module search test passed");
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(async () => db.$disconnect());
