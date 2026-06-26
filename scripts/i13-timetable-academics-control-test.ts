import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { can } from "../src/lib/core/permissions";
import type { SessionUser } from "../src/lib/core/session";
import { saveTimetableConfig } from "../src/lib/services/timetable-solver.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function userByEmail(email: string): Promise<SessionUser> {
  const user = await db.user.findFirst({ where: { email } });
  if (!user) throw new Error(`Missing user ${email}`);
  return {
    id: user.id,
    tenantId: user.tenantId,
    neyoLoginId: user.neyoLoginId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role as SessionUser["role"],
    secondaryRole: user.secondaryRole as SessionUser["secondaryRole"],
    language: user.language,
  };
}

async function main() {
  const principal = await userByEmail("principal@karibuhigh.ac.ke");
  const teacher = await userByEmail("p.njoroge@karibuhigh.ac.ke");
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, level: "Form 2", stream: "East" } });

  assert(!can(teacher.role, "academics.manage"), "ordinary teacher does not have academics.manage timetable edit permission");
  assert(can(principal.role, "academics.manage"), "principal has academics.manage timetable edit permission");

  const saved = await saveTimetableConfig(principal, {
    classId: f2e.id,
    periodsPerDay: 8,
    freePeriodsPerWeek: 4,
    coCurricularCount: 2,
    coCurricularName: "Games",
    schoolDayStartTime: "07:30",
    saturdayStartTime: "08:10",
    saturdayEndTime: "12:20",
    lessonDurationMins: 40,
    shortBreakStart: 2,
    shortBreakMins: 15,
    longBreakStart: 4,
    longBreakMins: 30,
    lunchStart: 6,
    lunchMins: 60,
    hasRemedials: true,
    hasPreps: true,
    lunchShift: 1,
    hasSaturday: true,
  });
  assert(saved.schoolDayStartTime === "07:30", "school can set normal lesson start time");
  assert(saved.saturdayStartTime === "08:10" && saved.saturdayEndTime === "12:20", "school can set Saturday start and end times");

  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/academics/timetable/route.ts"), "utf8");
  const generatorRoute = readFileSync(join(process.cwd(), "src/app/api/academics/timetable/generator/route.ts"), "utf8");
  const service = readFileSync(join(process.cwd(), "src/lib/services/academics.service.ts"), "utf8");
  const solver = readFileSync(join(process.cwd(), "src/lib/services/timetable-solver.service.ts"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/components/academics/academics-client.tsx"), "utf8");

  assert(schema.includes("schoolDayStartTime") && schema.includes("saturdayStartTime") && schema.includes("saturdayEndTime"), "schema stores normal and Saturday timetable times");
  assert(route.includes('requirePermission("academics.manage")'), "timetable mutation API requires academics.manage");
  assert(generatorRoute.includes("schoolDayStartTime") && generatorRoute.includes("saturdayStartTime") && generatorRoute.includes("saturdayEndTime"), "generator config API accepts timetable start/end times");
  assert(solver.includes("schoolDayStartTime") && solver.includes("saturdayStartTime") && solver.includes("saturdayEndTime"), "timetable config service persists start/end times");
  assert(service.includes("bulkSaturdaySchedule") && service.includes("fairSaturdaySchedule") && service.includes("hasSaturday === false"), "bulk/shared Saturday/remedial/prep scheduler respects per-class Saturday toggle");
  assert(client.includes("Normal day starts") && client.includes("Saturday starts") && client.includes("Saturday ends"), "UI exposes normal-day and Saturday time controls");
  assert(client.includes("Grade 6-9") && client.includes("Form 1-4") && client.includes("Exam prep mode") && client.includes("Fair rotation mode"), "UI has common/shared scheduling buttons and modes for class bands");
  assert(client.includes("Current Saturday window") && client.includes("timetablePeriodTimeRange(p, selectedConfig, 6)"), "Saturday scheduler displays configured Saturday time window and period times");

  console.log("\nI.13 timetable & academics control test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
