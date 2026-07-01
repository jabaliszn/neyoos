import { PrismaClient } from "@prisma/client";
import { runAutoGroupingPreview, commitAutoGrouping, saveAutoGroupingRule, saveTeacherWorkloadRule } from "../src/lib/services/l7-auto-grouping.service";

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
  const t = await db.tenant.findUnique({ where: { slug: "karibu-high" } });
  if (!t) throw new Error('tenant not found');
  const tid = t.id;
  const principal = su(await db.user.findFirst({ where: { tenantId: tid, role: 'PRINCIPAL' } }), tid);
  const suffix = Date.now() % 100000;

  const east = await db.schoolClass.create({ data: { tenantId: tid, level: `AG${suffix}`, stream: 'EAST', curriculum: '8-4-4' } });
  const west = await db.schoolClass.create({ data: { tenantId: tid, level: `AG${suffix}`, stream: 'WEST', curriculum: '8-4-4' } });
  const s1 = await db.student.create({ data: { tenantId: tid, admissionNo: `AG-${suffix}-1`, firstName: 'Akinyi', lastName: 'One', gender: 'F', classId: east.id } });
  const s2 = await db.student.create({ data: { tenantId: tid, admissionNo: `AG-${suffix}-2`, firstName: 'Baraka', lastName: 'Two', gender: 'M', classId: east.id } });
  const s3 = await db.student.create({ data: { tenantId: tid, admissionNo: `AG-${suffix}-3`, firstName: 'Chao', lastName: 'Three', gender: 'F', classId: west.id } });
  const s4 = await db.student.create({ data: { tenantId: tid, admissionNo: `AG-${suffix}-4`, firstName: 'Davis', lastName: 'Four', gender: 'M', classId: west.id } });
  const subj1 = await db.subject.create({ data: { tenantId: tid, name: `AG Physics ${suffix}`, code: `AGP${suffix}`, curriculum: '8-4-4' } });
  const subj2 = await db.subject.create({ data: { tenantId: tid, name: `AG History ${suffix}`, code: `AGH${suffix}`, curriculum: '8-4-4' } });
  const portal = await db.subjectSelectionPortal.create({ data: { tenantId: tid, name: `AG Portal ${suffix}`, targetLevel: east.level, openDate: new Date(), closeDate: new Date(Date.now()+86400000), status: 'OPEN', rulesJson: '{}' } });
  await db.studentSubjectSelection.createMany({ data: [
    { tenantId: tid, portalId: portal.id, studentId: s1.id, selectedSubjectIds: JSON.stringify([subj1.id]), isConfirmed: true },
    { tenantId: tid, portalId: portal.id, studentId: s2.id, selectedSubjectIds: JSON.stringify([subj1.id]), isConfirmed: true },
    { tenantId: tid, portalId: portal.id, studentId: s3.id, selectedSubjectIds: JSON.stringify([subj2.id]), isConfirmed: true },
    { tenantId: tid, portalId: portal.id, studentId: s4.id, selectedSubjectIds: JSON.stringify([subj2.id]), isConfirmed: true },
  ]});

  const t1 = await db.user.create({ data: { tenantId: tid, neyoLoginId: `agt${suffix}1`, fullName: 'AG Teacher One', role: 'TEACHER', isActive: true } as any });
  const t2 = await db.user.create({ data: { tenantId: tid, neyoLoginId: `agt${suffix}2`, fullName: 'AG Teacher Two', role: 'TEACHER', isActive: true } as any });
  await db.teacherSubject.createMany({ data: [
    { tenantId: tid, teacherId: t1.id, subjectId: subj1.id },
    { tenantId: tid, teacherId: t2.id, subjectId: subj1.id },
    { tenantId: tid, teacherId: t2.id, subjectId: subj2.id },
  ]});
  const need = await db.classSubjectNeed.create({ data: { tenantId: tid, classId: east.id, subjectId: subj1.id, teacherId: t1.id, lessonsPerWeek: 3 } });
  await db.schoolClass.update({ where: { id: east.id }, data: { classTeacherId: t1.id } });
  await db.user.update({ where: { id: t1.id }, data: { isActive: false } });

  try {
    await saveAutoGroupingRule(principal, { name: 'Keep subject continuity', targetLevel: east.level, ruleType: 'SCHOOL_DEFINED', priority: 10, active: true, config: { retainSubjectTeachers: true, retainClassTeachers: true, maxClassesPerTeacher: 4 } });
    await saveTeacherWorkloadRule(principal, { maxClasses: 4, retainSubjectLoads: true, retainClassTeacher: true });
    const preview = await runAutoGroupingPreview(principal, east.level);
    check('Preview returns the target level', preview.level === east.level);
    check('Preview uses subject-choice grouping rule', preview.ruleApplied.length > 0);
    check('Preview sees all active students in level', preview.totalStudents === 4);
    check('Preview groups students into available streams', preview.preview.length === 2);

    const commit = await commitAutoGrouping(principal, east.level);
    check('Commit returns a summary', commit.summary.includes('Auto-grouped'));
    const refreshedNeed = await db.classSubjectNeed.findUnique({ where: { id: need.id } });
    check('Transferred/inactive subject teacher is replaced fairly from available pool', refreshedNeed?.teacherId === t2.id);
    const refreshedClass = await db.schoolClass.findUnique({ where: { id: east.id } });
    check('Transferred/inactive class teacher is replaced', refreshedClass?.classTeacherId === t2.id);
    const run = await db.promotionRun.findUnique({ where: { id: commit.runId } });
    check('Auto-grouping run is logged in promotion history', run?.kind === 'auto_grouping');
  } finally {
    await db.promotionRun.deleteMany({ where: { tenantId: tid, kind: 'auto_grouping', summary: { contains: east.level } } }).catch(()=>{});
    await db.classGroupingRule.deleteMany({ where: { tenantId: tid, targetLevel: east.level } }).catch(()=>{});
    await db.teacherWorkloadRule.deleteMany({ where: { tenantId: tid } }).catch(()=>{});
    await db.studentSubjectSelection.deleteMany({ where: { portalId: portal.id } }).catch(()=>{});
    await db.subjectSelectionPortal.delete({ where: { id: portal.id } }).catch(()=>{});
    await db.classSubjectNeed.deleteMany({ where: { id: need.id } }).catch(()=>{});
    await db.teacherSubject.deleteMany({ where: { teacherId: { in: [t1.id, t2.id] } } }).catch(()=>{});
    await db.user.deleteMany({ where: { id: { in: [t1.id, t2.id] } } }).catch(()=>{});
    await db.subject.deleteMany({ where: { id: { in: [subj1.id, subj2.id] } } }).catch(()=>{});
    await db.student.deleteMany({ where: { id: { in: [s1.id, s2.id, s3.id, s4.id] } } }).catch(()=>{});
    await db.schoolClass.deleteMany({ where: { id: { in: [east.id, west.id] } } }).catch(()=>{});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('  ✅ L.7 auto-grouping all green');
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
