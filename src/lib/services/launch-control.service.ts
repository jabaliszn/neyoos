import { db } from "@/lib/db";

export async function isCurriculumEngineEnabled(): Promise<boolean> {
  const row = await db.platformSetting.findUnique({
    where: { key: "enable_curriculum_engine" }
  });
  return row?.value === "true";
}
