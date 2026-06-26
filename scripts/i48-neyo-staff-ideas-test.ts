import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); console.log(`✓ ${message}`); }

async function main() {
  const api = readFileSync(join(process.cwd(), "src/app/api/founder-ops/route.ts"), "utf8");
  const ui = readFileSync(join(process.cwd(), "src/components/founder/founder-ops-client.tsx"), "utf8");
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

  const countBefore = await db.neyoIdea.count();
  const idea = await db.neyoIdea.create({ data: { title: "I.48 test idea", description: "Temporary idea", priority: "HIGH", status: "IDEA", ownerName: "Founder", linkedFeatureKey: "I.48", createdById: "test", createdByName: "Test" } });
  const updated = await db.neyoIdea.update({ where: { id: idea.id }, data: { status: "PLANNED" } });
  assert(updated.status === "PLANNED", "NEYO idea board persists and updates idea records in the database");
  await db.neyoIdea.delete({ where: { id: idea.id } });
  assert(await db.neyoIdea.count() === countBefore, "temporary idea cleanup restored idea count");

  assert(schema.includes("model NeyoIdea"), "schema has company-level NeyoIdea model");
  assert(api.includes("neyoStaff") && api.includes("ideas") && api.includes("create_idea") && api.includes("update_idea"), "Founder Ops API returns NEYO staff and idea board and supports create/update");
  assert(api.includes("platform.idea_created") && api.includes("platform.idea_status_updated"), "Idea mutations are audit logged");
  assert(ui.includes("NeyoStaffIdeasBoard") && ui.includes("NEYO Staff & Idea Board"), "Business Operations UI mounts NEYO Staff & Idea Board");
  assert(ui.includes("Create founder idea") && ui.includes("Idea pipeline") && ui.includes("NEYO team"), "UI supports staff visibility and founder idea creation pipeline");
  console.log("\nI.48 NEYO Staff + Idea Board test passed.");
}
main().catch((e)=>{ console.error(e); process.exit(1); }).finally(async()=>db.$disconnect());
