import { PrismaClient } from "@prisma/client";
import { getContinuitySnapshot, saveContinuityPolicy, applyTeacherChangeWithImpact } from "../src/lib/services/l7-continuity-engine.service";

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

  const cls = await db.schoolClass.create({ data: { tenantId: tid, level: `CE${suffix}`, stream: 'EAST', curriculum: '8-4-4' } });
  const subj = await db.subject.create({ data: { tenantId: tid, name: `CE Subject ${suffix}`, code: `CES${suffix}`, curriculum: '8-4-4' } });
  const oldTeacher = await db.user.create({ data: { tenantId: tid, neyoLoginId: `ceold${suffix}`, fullName: 'Continuity Old Teacher', role: 'TEACHER', isActive: false } as any });
  const newTeacher = await db.user.create({ data: { tenantId: tid, neyoLoginId: `cenew${suffix}`, fullName: 'Continuity New Teacher', role: 'TEACHER', isActive: true } as any });
  await db.teacherSubject.create({ data: { tenantId: tid, teacherId: newTeacher.id, subjectId: subj.id } });
  const need = await db.classSubjectNeed.create({ data: { tenantId: tid, classId: cls.id, subjectId: subj.id, teacherId: oldTeacher.id, lessonsPerWeek: 3 } });
  await db.schoolClass.update({ where: { id: cls.id }, data: { classTeacherId: oldTeacher.id } });

  try {
    await saveContinuityPolicy(principal, { classId: cls.id, subjectId: subj.id, teacherId: oldTeacher.id, roleType: 'SUBJECT', locked: true });
    await saveContinuityPolicy(principal, { classId: cls.id, teacherId: oldTeacher.id, roleType: 'CLASS_TEACHER', locked: true });

    const snapshot = await getContinuitySnapshot(principal, cls.level);
    check('Snapshot returns the requested level', snapshot.level === cls.level);
    check('Subject teacher replacement is detected', snapshot.subjectAssignments.some((x: any) => x.needsReplacement));
    check('Replacement recommendation is produced', (snapshot.subjectAssignments[0]?.recommendations?.length ?? 0) > 0);
    check('Continuity snapshot includes timetable impact details', snapshot.subjectAssignments[0]?.impact?.timetableRegenerationRequired === true);
    check('Class teacher replacement is detected', snapshot.classTeacherAssignments.some((x: any) => x.needsReplacement));

    const applied = await applyTeacherChangeWithImpact(principal, { classId: cls.id, subjectId: subj.id, teacherId: newTeacher.id, roleType: 'SUBJECT', regenerateTimetable: false });
    check('Teacher change apply returns success', applied.success === true);
    const refreshed = await db.classSubjectNeed.findUnique({ where: { id: need.id } });
    check('Subject teacher was updated to recommended teacher', refreshed?.teacherId === newTeacher.id);
    const continuity = await db.teacherContinuityAssignment.findFirst({ where: { classId: cls.id, subjectId: subj.id, roleType: 'SUBJECT', active: true } });
    check('Continuity assignment updated and locked', continuity?.teacherId === newTeacher.id && continuity?.locked === true);
  } finally {
    await db.teacherContinuityAssignment.deleteMany({ where: { tenantId: tid, classId: cls.id } }).catch(()=>{});
    await db.classSubjectNeed.deleteMany({ where: { id: need.id } }).catch(()=>{});
    await db.teacherSubject.deleteMany({ where: { teacherId: { in: [oldTeacher.id, newTeacher.id] } } }).catch(()=>{});
    await db.user.deleteMany({ where: { id: { in: [oldTeacher.id, newTeacher.id] } } }).catch(()=>{});
    await db.subject.deleteMany({ where: { id: subj.id } }).catch(()=>{});
    await db.schoolClass.deleteMany({ where: { id: cls.id } }).catch(()=>{});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('  ✅ L.7 continuity engine all green');
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
