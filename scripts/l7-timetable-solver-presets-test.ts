import { PrismaClient } from "@prisma/client";
import { runGeneration } from "../src/lib/services/timetable-engine.service";

const db = new PrismaClient();
let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

function sessionUser(user: any, tenantId: string) {
  return {
    id: user.id,
    tenantId,
    neyoLoginId: user.neyoLoginId ?? user.id,
    fullName: user.fullName,
    phone: user.phone ?? null,
    email: user.email ?? null,
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    language: user.language ?? "en",
  } as any;
}

async function setLevels(tenantId: string, levels: string[]) {
  await db.tenant.update({ where: { id: tenantId }, data: { educationLevelsOffered: JSON.stringify(levels) } });
}

async function buildScenario(tenantId: string, suffix: string) {
  const classLevel = `Form ${suffix}`;
  const clsA = await db.schoolClass.create({ data: { tenantId, level: classLevel, stream: "EAST", curriculum: "CBC" } });
  const clsB = await db.schoolClass.create({ data: { tenantId, level: classLevel, stream: "WEST", curriculum: "CBC" } });
  const elective = await db.subject.create({ data: { tenantId, name: `SP-Elective-${suffix}`, code: `SPE${suffix}`, curriculum: "CBC" } });
  const core = await db.subject.create({ data: { tenantId, name: `SP-Core-${suffix}`, code: `SPC${suffix}`, curriculum: "CBC" } });
  const electiveTeacher = await db.user.create({ data: { tenantId, neyoLoginId: `spte${suffix}`, fullName: `SP Elective Teacher ${suffix}`, role: "TEACHER", isActive: true } as any });
  const coreTeacher = await db.user.create({ data: { tenantId, neyoLoginId: `sptc${suffix}`, fullName: `SP Core Teacher ${suffix}`, role: "TEACHER", isActive: true } as any });

  for (const c of [clsA, clsB]) {
    await db.timetableConfig.create({ data: { tenantId, classId: c.id, periodsPerDay: 8, freePeriodsPerWeek: 0, coCurricularCount: 0, lunchShift: 1 } });
    await db.classSubjectNeed.create({ data: { tenantId, classId: c.id, subjectId: core.id, teacherId: coreTeacher.id, lessonsPerWeek: 1, doubleCount: 0 } });
    await db.classSubjectNeed.create({ data: { tenantId, classId: c.id, subjectId: elective.id, teacherId: electiveTeacher.id, lessonsPerWeek: 1, doubleCount: 0 } });
  }

  const group = await db.combinationGroup.create({
    data: {
      tenantId,
      name: `SP Subject Choice Combo ${suffix}`,
      subjectId: elective.id,
      teacherId: electiveTeacher.id,
      lessonsPerWeek: 1,
      doubleCount: 0,
      scope: "SELECTED",
      source: "SUBJECT_CHOICE",
      active: true,
    },
  });
  await db.combinationGroupClass.create({ data: { tenantId, groupId: group.id, classId: clsA.id } });

  return { clsA, clsB, elective, core, electiveTeacher, coreTeacher, group };
}

async function cleanupScenario(tenantId: string, scenario: any, existingSlots: any[]) {
  const { clsA, clsB, elective, core, electiveTeacher, coreTeacher, group } = scenario;
  await db.timetableSlot.deleteMany({ where: { tenantId } }).catch(() => {});
  if (existingSlots.length > 0) {
    await db.timetableSlot.createMany({ data: existingSlots.map(({ id, ...rest }) => rest) }).catch(() => {});
  }
  await db.combinationGroupClass.deleteMany({ where: { groupId: group.id } }).catch(() => {});
  await db.combinationGroup.delete({ where: { id: group.id } }).catch(() => {});
  await db.classSubjectNeed.deleteMany({ where: { classId: { in: [clsA.id, clsB.id] } } }).catch(() => {});
  await db.timetableConfig.deleteMany({ where: { classId: { in: [clsA.id, clsB.id] } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [electiveTeacher.id, coreTeacher.id] } } }).catch(() => {});
  await db.subject.deleteMany({ where: { id: { in: [elective.id, core.id] } } }).catch(() => {});
  await db.schoolClass.deleteMany({ where: { id: { in: [clsA.id, clsB.id] } } }).catch(() => {});
}

function hasWarning(result: any, phrase: string) {
  return (result.warnings ?? []).some((w: any) => {
    if (typeof w === "string") return w.includes(phrase);
    if (w && typeof w.message === "string") return w.message.includes(phrase);
    return false;
  });
}

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!tenant) throw new Error("Tenant not found");
  const tenantId = tenant.id;
  const originalLevels = tenant.educationLevelsOffered ?? null;
  const principalRow = await db.user.findFirst({ where: { tenantId, role: "PRINCIPAL" } });
  if (!principalRow) throw new Error("Principal not found");
  const principal = sessionUser(principalRow, tenantId);
  const existingSlots = await db.timetableSlot.findMany({ where: { tenantId } });
  const jobIds: string[] = [];
  const suffix = String(Date.now() % 100000);

  try {
    const scenario = await buildScenario(tenantId, suffix);

    await setLevels(tenantId, ["SENIOR_SCHOOL"]);
    const seniorJob = await db.timetableGenerationJob.create({ data: { tenantId, status: "QUEUED", phase: "Queued", startedById: principal.id, startedByName: principal.fullName } });
    jobIds.push(seniorJob.id);
    const seniorResult = await runGeneration(tenantId, seniorJob.id, principal);
    const seniorSlots = await db.timetableSlot.findMany({ where: { tenantId, classId: { in: [scenario.clsA.id, scenario.clsB.id] }, subjectId: scenario.elective.id } });
    const seniorClasses = Array.from(new Set(seniorSlots.map((s) => s.classId))).sort();

    check("Senior preset warning is returned", hasWarning(seniorResult, "Senior School preset bias applied"));
    check(
      "Senior preset expands subject-choice selected combination to all classes with the subject need",
      seniorClasses.length === 2 && seniorClasses.includes(scenario.clsA.id) && seniorClasses.includes(scenario.clsB.id)
    );

    await db.timetableSlot.deleteMany({ where: { tenantId } });

    await setLevels(tenantId, ["JUNIOR_SCHOOL"]);
    const juniorJob = await db.timetableGenerationJob.create({ data: { tenantId, status: "QUEUED", phase: "Queued", startedById: principal.id, startedByName: principal.fullName } });
    jobIds.push(juniorJob.id);
    const juniorResult = await runGeneration(tenantId, juniorJob.id, principal);
    const juniorSlots = await db.timetableSlot.findMany({ where: { tenantId, classId: { in: [scenario.clsA.id, scenario.clsB.id] }, subjectId: scenario.elective.id } });
    const juniorClasses = Array.from(new Set(juniorSlots.map((s) => s.classId))).sort();

    check("Junior preset warning is returned", hasWarning(juniorResult, "Junior School preset bias applied"));
    check(
      "Junior preset stays subject-selection-aware without Senior-only combination-rich warning logic",
      !hasWarning(juniorResult, "Senior School preset bias applied")
    );

    await db.timetableSlot.deleteMany({ where: { tenantId } });

    await setLevels(tenantId, ["PRIMARY"]);
    const lowerJob = await db.timetableGenerationJob.create({ data: { tenantId, status: "QUEUED", phase: "Queued", startedById: principal.id, startedByName: principal.fullName } });
    jobIds.push(lowerJob.id);
    const lowerResult = await runGeneration(tenantId, lowerJob.id, principal);

    check("Lower-level preset warning is returned", hasWarning(lowerResult, "Lower-level preset bias applied"));

    await cleanupScenario(tenantId, scenario, existingSlots);
  } finally {
    await db.timetableGenerationJob.deleteMany({ where: { id: { in: jobIds } } }).catch(() => {});
    await db.tenant.update({ where: { id: tenantId }, data: { educationLevelsOffered: originalLevels } }).catch(() => {});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("  ✅ L.7 solver preset specialization all green");
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
