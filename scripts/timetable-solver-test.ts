/** G.18 Whole-School Timetable Generator — solver live test (SELF-HEALS). */
import { db } from "../src/lib/db";
import {
  saveTeacherSubjects, saveClassSubjectNeed, saveTimetableConfig,
  getTimetableInputs, generateWholeSchoolTimetable,
} from "../src/lib/services/timetable-solver.service";
import type { SessionUser } from "../src/lib/core/session";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

async function su(email: string): Promise<SessionUser> {
  const u = await db.user.findFirstOrThrow({ where: { email } });
  return { id: u.id, tenantId: u.tenantId, fullName: u.fullName, role: u.role, email: u.email, phone: u.phone, language: "en" } as SessionUser;
}

async function main() {
  const principal = await su("principal@karibuhigh.ac.ke");
  const chebet = await db.user.findFirstOrThrow({ where: { email: "f.chebet@karibuhigh.ac.ke" } });
  const f2e = await db.schoolClass.findFirstOrThrow({ where: { tenantId: principal.tenantId, level: "Form 2" } });
  const math = await db.subject.findFirstOrThrow({ where: { tenantId: principal.tenantId, code: "MAT" } });

  // Cleanup prior test runs
  await db.teacherSubject.deleteMany({ where: { tenantId: principal.tenantId, teacherId: chebet.id } });
  await db.classSubjectNeed.deleteMany({ where: { tenantId: principal.tenantId, classId: f2e.id } });

  // 1) Save Teacher Subjects association
  await saveTeacherSubjects(principal, chebet.id, [math.id]);
  const sids = await db.teacherSubject.findMany({ where: { teacherId: chebet.id } });
  assert("teacher subject mapped successfully", sids.length === 1 && sids[0].subjectId === math.id);

  // 2) Save Class Subject weekly lessons need (Mathematics × 5, taught by Chebet)
  await saveClassSubjectNeed(principal, {
    classId: f2e.id,
    subjectId: math.id,
    lessonsPerWeek: 5,
    teacherId: chebet.id,
  });
  const need = await db.classSubjectNeed.findUnique({
    where: { tenantId_classId_subjectId: { tenantId: principal.tenantId, classId: f2e.id, subjectId: math.id } },
  });
  assert("class subject weekly lessons need saved", need?.lessonsPerWeek === 5 && need?.teacherId === chebet.id);

  // 3) Save general timetable config (8 periods, Friday Games block, 4 free periods)
  await saveTimetableConfig(principal, {
    classId: f2e.id,
    periodsPerDay: 8,
    freePeriodsPerWeek: 4,
    coCurricularCount: 2,
    coCurricularName: "Games",
  });
  const cfg = await db.timetableConfig.findUnique({ where: { classId: f2e.id } });
  assert("timetable config saved successfully", cfg?.freePeriodsPerWeek === 4 && cfg?.coCurricularName === "Games");

  // 4) Fetch inputs to check
  const inputs = await getTimetableInputs(principal);
  assert("inputs contains active classes", inputs.classes.length > 0);
  assert("inputs contains active subjects", inputs.subjects.length > 0);

  // 5) Generate WHOLE-SCHOOL conflict-free timetable slots
  const gen = await generateWholeSchoolTimetable(principal);
  assert("timetable generated successfully", gen.success === true);
  assert("placed multiple slots across classes", gen.slotsPlacedCount > 0);

  // Verify no teacher or class double-bookings in the database
  const slots = await db.timetableSlot.findMany({ where: { tenantId: principal.tenantId } });
  
  // Checking Class double-bookings (unique per [classId, dayOfWeek, period])
  const classBookings = new Set<string>();
  let hasClassConflict = false;
  for (const s of slots) {
    const key = `${s.classId}:${s.dayOfWeek}:${s.period}`;
    if (classBookings.has(key)) {
      hasClassConflict = true;
    }
    classBookings.add(key);
  }
  assert("no class double-bookings (conflict-free by class)", !hasClassConflict);

  // Checking Teacher double-bookings (unique per [teacherId, dayOfWeek, period])
  const teacherBookings = new Set<string>();
  let hasTeacherConflict = false;
  for (const s of slots) {
    if (!s.teacherId) continue;
    const key = `${s.teacherId}:${s.dayOfWeek}:${s.period}`;
    if (teacherBookings.has(key)) {
      hasTeacherConflict = true;
    }
    teacherBookings.add(key);
  }
  assert("no teacher double-bookings (conflict-free by teacher)", !hasTeacherConflict);

  // Clean up test rows and restore seed state
  await db.teacherSubject.deleteMany({ where: { tenantId: principal.tenantId, teacherId: chebet.id } });
  await db.classSubjectNeed.deleteMany({ where: { tenantId: principal.tenantId, classId: f2e.id } });
  await db.timetableSlot.deleteMany({ where: { tenantId: principal.tenantId } });
  
  // Re-run seed to bring back standard slots
  const { execSync } = await import("child_process");
  execSync("npx tsx --env-file=.env prisma/seed.ts", { cwd: process.cwd(), stdio: "pipe" });

  console.log(`\nG.18 Timetable Generator: ${passed} passed, ${failed} failed ${failed === 0 ? "✅" : "❌"}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
