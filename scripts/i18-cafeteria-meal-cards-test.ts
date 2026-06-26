import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import type { Role } from "@/lib/core/roles";
import {
  allocateCafeteriaTables,
  cafeteriaPolicy,
  clearCafeteriaTables,
  issueCard,
  setCafeteriaPolicy,
  tableBoard,
} from "@/lib/services/cafeteria.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asUser(u: any): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    neyoLoginId: u.neyoLoginId,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    secondaryRole: u.secondaryRole as Role | null,
    language: u.language ?? "en",
  };
}

async function expectInvalid(fn: () => Promise<unknown>, message: string) {
  try { await fn(); } catch (e) {
    assert(/disabled|lunch|supper|card|model/i.test((e as Error).message), message);
    return;
  }
  throw new Error(`Expected invalid: ${message}`);
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const bursar = asUser(await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, email: "bursar@karibuhigh.ac.ke" } }));
  const original = await cafeteriaPolicy(bursar);
  const student = await db.student.findFirstOrThrow({ where: { tenantId: tenant.id, firstName: "Achieng" } });

  try {
    const policy = await setCafeteriaPolicy(bursar, { mealModel: "NO_CARDS", mealScope: "LUNCH" });
    assert(policy.mealModel === "NO_CARDS" && !policy.mealCardsEnabled, "school can remove physical meal cards entirely through real cafeteria policy");
    await expectInvalid(
      () => issueCard(bursar, { studentId: student.id, meals: ["LUNCH"], termFeeKes: 6500, year: 2026, term: 2 }),
      "meal card issuing is blocked when school chooses no physical cards"
    );

    const lunchOnly = await setCafeteriaPolicy(bursar, { mealModel: "HYBRID", mealScope: "LUNCH" });
    assert(lunchOnly.mealCardsEnabled && lunchOnly.mealScope === "LUNCH", "school can choose hybrid model with lunch-only individual cards");
    await expectInvalid(
      () => issueCard(bursar, { studentId: student.id, meals: ["SUPPER"], termFeeKes: 6500, year: 2026, term: 2 }),
      "meal scope blocks supper cards when lunch-only model is selected"
    );

    await clearCafeteriaTables(bursar, "LUNCH");
    const board = await allocateCafeteriaTables(bursar, { session: "LUNCH", tableSize: 2 });
    assert(board.totalSeated > 0 && board.totalTables > 0, "cafeteria table allocation creates a saved group/table plan");
    assert(board.classes.every((c: any) => c.tables.every((t: any) => t.students.length <= 2)), "table plan respects chosen number per group/table");
    assert(board.classes.every((c: any) => c.tables.every((t: any) => new Set(t.students.map((s: any) => s.id)).size === t.students.length)), "table plan stores learner names per class table without mixing table rows");
    const readBack = await tableBoard(bursar, "LUNCH");
    assert(readBack.classes.every((c: any) => c.classLabel.includes("Form") || c.classLabel.includes("Grade")), "tables are grouped by class/stream labels");

    const cafeteriaService = readFileSync(join(process.cwd(), "src/lib/services/cafeteria.service.ts"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/app/api/cafeteria/route.ts"), "utf8");
    const client = readFileSync(join(process.cwd(), "src/components/cafeteria/cafeteria-client.tsx"), "utf8");
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

    assert(schema.includes("cafeteriaMealModel") && schema.includes("cafeteriaMealScope"), "database stores flexible cafeteria meal model and scope");
    assert(cafeteriaService.includes("cafeteriaPolicy") && cafeteriaService.includes("setCafeteriaPolicy") && cafeteriaService.includes("BOARDING_GROUPS"), "cafeteria service has real flexible meal model policy");
    assert(route.includes('action === "setPolicy"') && route.includes("cafeteriaPolicy"), "cafeteria API exposes policy read/write through real endpoints");
    assert(client.includes("Hybrid: boarding groups + day cards") && client.includes("No physical meal cards"), "cafeteria UI lets school choose flexible meal-card model");
    assert(client.includes("Lunch only") && client.includes("Supper only") && client.includes("Students are seated per class"), "cafeteria UI supports lunch/supper models and per-class table allocation");

    console.log("\nI.18 Cafeteria / Meal Cards test passed.");
  } finally {
    await setCafeteriaPolicy(bursar, { mealModel: original.mealModel, mealScope: original.mealScope });
    await clearCafeteriaTables(bursar, "LUNCH").catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => db.$disconnect());
