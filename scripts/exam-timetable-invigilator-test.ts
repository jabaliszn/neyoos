import { PrismaClient } from "@prisma/client";
import { generateExamInvigilators, saveExamTimetableSlot, saveExamInvigilatorPool } from "../src/lib/services/exam-timetable-invigilator.service";

const db = new PrismaClient();
let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}
function su(u: any, tenantId: string) {
  return { id: u.id, tenantId, neyoLoginId: u.id, fullName: u.fullName, phone: null, email: u.email, role: u.role, secondaryRole: null, language: "en" } as any;
}

async function main() {
  const t = await db.tenant.findUnique({ where: { slug: 'karibu-high' } });
  if (!t) throw new Error('tenant not found');
  const tid = t.id;
  const principal = su(await db.user.findFirst({ where: { tenantId: tid, role: 'PRINCIPAL' } }), tid);
  const suffix = Date.now() % 100000;

  const examClass = await db.schoolClass.create({ data: { tenantId: tid, level: `EX${suffix}`, stream: 'EAST', curriculum: '8-4-4' } });
  const normalClass = await db.schoolClass.create({ data: { tenantId: tid, level: `NX${suffix}`, stream: 'WEST', curriculum: '8-4-4' } });
  const subj = await db.subject.create({ data: { tenantId: tid, name: `Exam Subject ${suffix}`, code: `EXS${suffix}`, curriculum: '8-4-4' } });
  const paper = await db.subjectPaperConfig.create({ data: { tenantId: tid, subjectId: subj.id, classId: examClass.id, name: 'PP1', outOfMarks: 100, weightPct: 50 } });
  const busyTeacher = await db.user.create({ data: { tenantId: tid, neyoLoginId: `busy${suffix}`, fullName: 'Busy Teacher', role: 'TEACHER', isActive: true } as any });
  const freeTeacher = await db.user.create({ data: { tenantId: tid, neyoLoginId: `free${suffix}`, fullName: 'Free Teacher', role: 'TEACHER', isActive: true } as any });
  await db.classSubjectNeed.create({ data: { tenantId: tid, classId: normalClass.id, subjectId: subj.id, teacherId: freeTeacher.id, lessonsPerWeek: 3 } });
  await db.classSubjectNeed.create({ data: { tenantId: tid, classId: examClass.id, subjectId: subj.id, teacherId: busyTeacher.id, lessonsPerWeek: 4 } });
  const seedTeachers = await db.user.findMany({ where: { tenantId: tid, isActive: true, role: { in: ['TEACHER', 'CLASS_TEACHER', 'HOD', 'DEPUTY_PRINCIPAL', 'DEAN_OF_STUDIES'] }, id: { notIn: [busyTeacher.id, freeTeacher.id] } }, select: { id: true } });
  await db.classSubjectNeed.createMany({ data: seedTeachers.map((t) => ({ tenantId: tid, classId: normalClass.id, subjectId: subj.id, teacherId: t.id, lessonsPerWeek: 2 })) }).catch(()=>({count:0}));
  await db.timetableSlot.create({ data: { tenantId: tid, classId: normalClass.id, subjectId: subj.id, teacherId: busyTeacher.id, dayOfWeek: 1, period: 1, slotType: 'ACADEMIC' } });
  await db.timetableSlot.createMany({ data: seedTeachers.map((t) => ({ tenantId: tid, classId: normalClass.id, subjectId: subj.id, teacherId: t.id, dayOfWeek: 1, period: 1, slotType: 'ACADEMIC' })) }).catch(()=>({count:0}));

  try {
    const created = await saveExamTimetableSlot(principal, { classId: examClass.id, subjectId: subj.id, paperConfigId: paper.id, examName: `Midterm ${suffix}`, paperName: 'PP1', examDate: '2026-07-01', startTime: '08:00', endTime: '10:00', venue: 'Hall', targetScope: 'CLASS', targetIds: [examClass.id], invigilatorScope: 'ELIGIBLE_ONLY', eligibleInvigilatorIds: [busyTeacher.id, freeTeacher.id], notes: '' });
    await saveExamInvigilatorPool(principal, { examName: `Midterm ${suffix}`, slotId: created.id, invigilatorScope: 'ELIGIBLE_ONLY', eligibleInvigilatorIds: [busyTeacher.id, freeTeacher.id] });
    const result = await generateExamInvigilators(principal, `Midterm ${suffix}`);
    const slot = result.slots[0];
    check('Exam invigilator generation returns one slot', result.generated === 1);
    check('Free teacher is preferred over teacher teaching another class', slot.invigilators?.[0]?.teacherId === freeTeacher.id);
    check('No fallback warning when a free teacher exists', (slot.warnings ?? []).length === 0);

    await db.user.update({ where: { id: freeTeacher.id }, data: { isActive: false } });
    const fallback = await generateExamInvigilators(principal, `Midterm ${suffix}`);
    const slot2 = fallback.slots[0];
    check('System still generates when no fully free teacher exists', !!slot2.invigilators?.[0]?.teacherId);
    check('Fallback warning is shown when normal teaching may be affected', (slot2.warnings ?? []).some((w: string) => w.includes('Fallback used')));
  } finally {
    await db.examTimetableSlot.deleteMany({ where: { tenantId: tid, examName: `Midterm ${suffix}` } }).catch(()=>{});
    await db.timetableSlot.deleteMany({ where: { tenantId: tid, classId: normalClass.id } }).catch(()=>{});
    await db.classSubjectNeed.deleteMany({ where: { tenantId: tid, classId: { in: [examClass.id, normalClass.id] } } }).catch(()=>{});
    await db.teacherSubject.deleteMany({ where: { teacherId: { in: [busyTeacher.id, freeTeacher.id] } } }).catch(()=>{});
    await db.user.deleteMany({ where: { id: { in: [busyTeacher.id, freeTeacher.id] } } }).catch(()=>{});
    await db.subjectPaperConfig.deleteMany({ where: { id: paper.id } }).catch(()=>{});
    await db.subject.deleteMany({ where: { id: subj.id } }).catch(()=>{});
    await db.schoolClass.deleteMany({ where: { id: { in: [examClass.id, normalClass.id] } } }).catch(()=>{});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('  ✅ Exam timetable + invigilators all green');
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
