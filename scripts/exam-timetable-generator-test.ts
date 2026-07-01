import { PrismaClient } from '@prisma/client';
import { generateExamTimetableFromRules } from '../src/lib/services/exam-timetable-generator.service';

const prisma = new PrismaClient();

const user = {
  id: 'cmqygd9sn0002zez9nso0o6qk',
  tenantId: 'cmqygd9rn0000zez92acydd56',
  neyoLoginId: 'KH-U-000001',
  fullName: 'Wanjiru Kamau',
  phone: '+254700000001',
  email: 'principal@karibuhigh.ac.ke',
  role: 'PRINCIPAL',
  secondaryRole: null,
  language: 'en',
} as any;

function expect(condition: any, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}


async function ensurePaperConfig(subjectId: string, classId: string | null, name: string, weightPct: number) {
  const existing = await prisma.subjectPaperConfig.findFirst({ where: { tenantId: user.tenantId, subjectId, classId, name } });
  if (existing) return existing;
  return prisma.subjectPaperConfig.create({
    data: {
      tenantId: user.tenantId,
      subjectId,
      classId,
      name,
      outOfMarks: 100,
      weightPct,
    },
  });
}

async function ensureSubjectNeed(classId: string, subjectId: string, teacherId: string) {
  const existing = await prisma.classSubjectNeed.findFirst({ where: { tenantId: user.tenantId, classId, subjectId } });
  if (existing) return existing;
  return prisma.classSubjectNeed.create({
    data: {
      tenantId: user.tenantId,
      classId,
      subjectId,
      teacherId,
      lessonsPerWeek: 5,
      doubleCount: 0,
      allowSplitDouble: false,
    },
  });
}

async function main() {
  const examName = `Auto Gen QA ${Date.now()}`;
  const classes = await prisma.schoolClass.findMany({ where: { tenantId: user.tenantId, archived: false }, orderBy: [{ level: 'asc' }, { stream: 'asc' }], take: 2 });
  expect(classes.length >= 1, 'Seed classes exist');

  const subject = await prisma.subject.findFirst({ where: { tenantId: user.tenantId, archived: false } });
  const teacher = await prisma.user.findFirst({ where: { tenantId: user.tenantId, role: { in: ['TEACHER', 'CLASS_TEACHER', 'HOD'] }, isActive: true } });
  expect(!!subject, 'Seed subject exists');
  expect(!!teacher, 'Seed teacher exists');

  for (const klass of classes) {
    await ensureSubjectNeed(klass.id, subject!.id, teacher!.id);
    await ensurePaperConfig(subject!.id, klass.id, 'Insha', 40);
    await ensurePaperConfig(subject!.id, klass.id, 'Oral', 20);
  }

  const result = await generateExamTimetableFromRules(user, {
    examName,
    classIds: classes.map((c) => c.id),
    startDate: '2026-07-14',
    endDate: '2026-07-20',
    periods: [
      { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
      { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
      { label: 'Afternoon 1', startTime: '14:00', endTime: '16:00' },
    ],
    notes: 'Generator test run',
    autoGenerateInvigilators: true,
  });

  expect(result.generatedCount > 0, 'Generator creates exam slots');
  expect(result.slots.some((slot) => slot.paperName === 'Insha'), 'Custom paper names are generated from class-specific subject paper design');
  expect(result.slots.some((slot) => slot.paperName === 'Oral'), 'Multiple papers for the same subject can be generated');
  expect(result.slots.every((slot) => slot.targetScope === 'CLASS'), 'First version generates one paper per class per period');
  expect(result.slots.every((slot) => Array.isArray(slot.targetIds) && slot.targetIds.length === 1), 'Generated slots carry one target class each');

  const uniqueKeys = new Set(result.slots.map((slot) => `${slot.classId}:${slot.examDate}:${slot.startTime}`));
  expect(uniqueKeys.size === result.slots.length, 'No class gets two papers in the same generated period');


  const fallbackExamName = `Auto Gen Fallback ${Date.now()}`;
  const fallbackSubject = await prisma.subject.findFirst({
    where: {
      tenantId: user.tenantId,
      archived: false,
      NOT: { SubjectPaperConfig: { some: {} } },
    },
  });
  if (fallbackSubject) {
    await ensureSubjectNeed(classes[0].id, fallbackSubject.id, teacher!.id);
    const fallbackResult = await generateExamTimetableFromRules(user, {
      examName: fallbackExamName,
      classIds: [classes[0].id],
      startDate: '2026-07-21',
      endDate: '2026-07-24',
      periods: [
        { label: 'Morning 1', startTime: '08:00', endTime: '10:00' },
        { label: 'Morning 2', startTime: '10:30', endTime: '12:30' },
        { label: 'Afternoon 1', startTime: '14:00', endTime: '16:00' },
      ],
    });
    expect(fallbackResult.slots.length > 0, 'Fallback paper preset generation works when no subject paper config exists');
  }

  const run = await prisma.examTimetableGeneratorRun.findFirst({ where: { tenantId: user.tenantId, examName } });
  expect(!!run, 'Generator run record is saved');
  expect(result.invigilatorsGenerated === true, 'Invigilators can be generated immediately after timetable generation');

  console.log('\n  ✅ Exam timetable auto-generator foundation green');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
