import { PrismaClient } from '@prisma/client';
import { getSchoolProfile, updateSchoolProfile } from '../src/lib/services/school-profile.service';

const prisma = new PrismaClient();
const tenantId = 'cmqygd9rn0000zez92acydd56';

function expect(condition: any, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  const before = await getSchoolProfile(tenantId);
  const updated = await updateSchoolProfile(tenantId, {
    educationLevelsOffered: ['JUNIOR_SCHOOL', 'SENIOR_SCHOOL'],
  } as any, {
    id: 'cmqygd9sn0002zez9nso0o6qk',
    name: 'Wanjiru Kamau',
  });

  expect(Array.isArray(updated.educationLevelsOffered), 'Education levels are returned as an array');
  expect(updated.educationLevelsOffered.includes('JUNIOR_SCHOOL'), 'Junior School can be activated');
  expect(updated.educationLevelsOffered.includes('SENIOR_SCHOOL'), 'Senior School can be activated');

  const raw = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const stored = JSON.parse(raw.educationLevelsOffered || '[]');
  expect(stored.includes('JUNIOR_SCHOOL') && stored.includes('SENIOR_SCHOOL'), 'Education levels persist on tenant profile');

  await updateSchoolProfile(tenantId, {
    educationLevelsOffered: before.educationLevelsOffered,
  } as any, {
    id: 'cmqygd9sn0002zez9nso0o6qk',
    name: 'Wanjiru Kamau',
  });

  console.log('\n  ✅ School level activation profile green');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
