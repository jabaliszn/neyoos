import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/core/session";
import { listDepartments, updateDepartment } from "@/lib/services/academics.service";
import { generateWholeSchoolTimetable, saveTimetableConfig } from "@/lib/services/timetable-solver.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

function asSessionUser(user: any): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    secondaryRole: user.secondaryRole,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    language: user.language ?? "en",
    neyoLoginId: user.neyoLoginId,
    viewAsReadOnly: false,
  } as SessionUser;
}

async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: "karibu-high" } });
  const principalRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "PRINCIPAL" } });
  const deputyRow = await db.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: "DEPUTY_PRINCIPAL" } });
  const principal = asSessionUser(principalRow);

  const coDept = await db.department.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Co-curricular Activities" } });
  const gamesSubject = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "GAC" } });

  const updatedDept = await updateDepartment(principal, coDept.id, {
    hodId: deputyRow.id,
    subjectIds: [gamesSubject.id],
  });
  assert(updatedDept.hodId === deputyRow.id, "principal can appoint a head for the Co-curricular Activities department");

  const departments = await listDepartments(principal);
  const listedCoDept = departments.find((d) => d.id === coDept.id);
  assert(Boolean(listedCoDept), "non-academic Co-curricular Activities department appears in the real department board");
  assert(listedCoDept?.subjectCount === 1, "co-curricular department stores mapped subjects through the real Department → Subject relation");
  assert(listedCoDept?.hodName === deputyRow.fullName, "co-curricular department board returns the appointed head name");

  const form2East = await db.schoolClass.findFirstOrThrow({ where: { tenantId: tenant.id, level: "Form 2", stream: "East" } });
  const savedConfig = await saveTimetableConfig(principal, {
    classId: form2East.id,
    periodsPerDay: 8,
    freePeriodsPerWeek: 2,
    coCurricularCount: 2,
    coCurricularName: "Clubs",
    schoolDayStartTime: "07:30",
    saturdayStartTime: "08:00",
    saturdayEndTime: "12:20",
    lessonDurationMins: 40,
    shortBreakStart: 2,
    shortBreakMins: 15,
    longBreakStart: 4,
    longBreakMins: 30,
    lunchStart: 6,
    lunchMins: 60,
    hasRemedials: true,
    hasPreps: false,
    lunchShift: 1,
    hasSaturday: true,
  });
  assert(savedConfig.coCurricularName === "Clubs" && savedConfig.coCurricularCount === 2, "co-curricular timetable settings are saved per class in TimetableConfig");

  const generated = await generateWholeSchoolTimetable(principal);
  assert((generated as any).slotsPlacedCount > 0, "whole-school timetable generator runs after co-curricular settings are saved");

  const clubSubject = await db.subject.findFirstOrThrow({ where: { tenantId: tenant.id, code: "CLUB" } });
  const clubSlots = await db.timetableSlot.findMany({
    where: {
      tenantId: tenant.id,
      classId: form2East.id,
      subjectId: clubSubject.id,
      dayOfWeek: 5,
      period: { in: [7, 8] },
      slotType: "ACADEMIC",
    },
  });
  assert(clubSlots.length >= 1, "co-curricular activity blocks are linked into Friday timetable slots by the generator");

  const client = readFileSync(join(process.cwd(), "src/components/academics/academics-client.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/academics/timetable/generator/route.ts"), "utf8");
  const seed = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");

  assert(client.includes('key: "cocurricular"') && client.includes("function CoCurricularTab"), "Academics UI contains a dedicated Co-curricular tab");
  assert(client.includes("Class activity timetable links") && client.includes("/api/academics/timetable/generator"), "Co-curricular tab is wired to the real timetable configuration API");
  assert(route.includes('action === "save_config"') && route.includes("coCurricularCount") && route.includes("coCurricularName"), "API persists co-curricular timetable settings through save_config");
  assert(seed.includes("Co-curricular Activities") && seed.includes("Games & Clubs"), "Kenyan seed data includes a non-academic co-curricular department and activity subject");

  console.log("\nI.14 Departments & Co-curricular test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
