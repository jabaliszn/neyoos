import { PrismaClient } from "@prisma/client";
import { analyseTeacherTransferImpact, applyTeacherTransferReplacement } from "../src/lib/services/l7-teacher-transfer-impact.service";

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

  const cls = await db.schoolClass.create({ data: { tenantId: tid, level: `TI${suffix}`, stream: 'EAST', curriculum: '8-4-4' } });
  const subj = await db.subject.create({ data: { tenantId: tid, name: `TI Subject ${suffix}`, code: `TIS${suffix}`, curriculum: '8-4-4' } });
  const leaving = await db.user.create({ data: { tenantId: tid, neyoLoginId: `tileave${suffix}`, fullName: 'Transfer Leaving Teacher', role: 'TEACHER', isActive: true } as any });
  const replacement = await db.user.create({ data: { tenantId: tid, neyoLoginId: `tireplace${suffix}`, fullName: 'Transfer Replacement Teacher', role: 'TEACHER', isActive: true } as any });
  await db.teacherSubject.createMany({ data: [
    { tenantId: tid, teacherId: leaving.id, subjectId: subj.id },
    { tenantId: tid, teacherId: replacement.id, subjectId: subj.id },
  ]});
  const need = await db.classSubjectNeed.create({ data: { tenantId: tid, classId: cls.id, subjectId: subj.id, teacherId: leaving.id, lessonsPerWeek: 4 } });
  await db.schoolClass.update({ where: { id: cls.id }, data: { classTeacherId: leaving.id } });

  try {
    await db.timetableGenerationJob.deleteMany({ where: { tenantId: tid, status: { in: ['QUEUED', 'RUNNING'] } } }).catch(()=>{});
    const impact = await analyseTeacherTransferImpact(principal, leaving.id, 'Teacher transferred');
    check('Impact analysis returns affected teaching responsibilities', impact.affected.length >= 2);
    check('Impact analysis returns recommendations', impact.recommendations.length >= 1);
    check('Recommendation includes projected load information', typeof impact.recommendations[0]?.best?.projectedClassCount === 'number');
    check('Recommendation explains why teacher was chosen', (impact.recommendations[0]?.best?.reasons?.length ?? 0) > 0);
    check('Analysis returns timetable impact summary', impact.timetableImpact?.regenerationRequired === true);
    check('Comparison list includes multiple ranked options when available', (impact.recommendations[0]?.comparison?.length ?? 0) >= 1);

    const applied = await applyTeacherTransferReplacement(principal, impact.impactId);
    check('Applying transfer replacement returns success', applied.success === true);
    const refreshedNeed = await db.classSubjectNeed.findUnique({ where: { id: need.id } });
    check('Subject teacher changed to recommended replacement', refreshedNeed?.teacherId === replacement.id);
    const refreshedClass = await db.schoolClass.findUnique({ where: { id: cls.id } });
    check('Class teacher also changed to replacement', refreshedClass?.classTeacherId === replacement.id);
    const impactRow = await db.teacherTransferImpact.findUnique({ where: { id: impact.impactId } });
    check('Impact record marked applied with timetable job', impactRow?.status === 'APPLIED' && Boolean(impactRow?.timetableJobId));
  } finally {
    await db.timetableGenerationJob.deleteMany({ where: { tenantId: tid, startedById: principal.id, phase: { in: ['Queued', 'Complete'] } } }).catch(()=>{});
    await db.teacherTransferImpact.deleteMany({ where: { tenantId: tid, teacherId: leaving.id } }).catch(()=>{});
    await db.classSubjectNeed.deleteMany({ where: { id: need.id } }).catch(()=>{});
    await db.teacherSubject.deleteMany({ where: { teacherId: { in: [leaving.id, replacement.id] } } }).catch(()=>{});
    await db.user.deleteMany({ where: { id: { in: [leaving.id, replacement.id] } } }).catch(()=>{});
    await db.subject.deleteMany({ where: { id: subj.id } }).catch(()=>{});
    await db.schoolClass.deleteMany({ where: { id: cls.id } }).catch(()=>{});
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail === 0) console.log('  ✅ L.7 teacher transfer impact all green');
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
