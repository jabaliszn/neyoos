import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.platformSetting.upsert({
    where: { key: "enable_curriculum_engine" },
    update: { value: "true" },
    create: { key: "enable_curriculum_engine", value: "true", updatedBy: "System" }
  });
  console.log("✓ Seeded Curriculum Engine toggle flag.");
}
main().catch(console.error).finally(() => db.$disconnect());
