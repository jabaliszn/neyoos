import { getSchoolLevelActivationSummary, updateSchoolProfile, getSchoolProfile } from '../src/lib/services/school-profile.service';

const tenantId = 'cmqygd9rn0000zez92acydd56';

function expect(condition: any, message: string) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function main() {
  const before = await getSchoolProfile(tenantId);
  await updateSchoolProfile(tenantId, {
    educationLevelsOffered: ['PRIMARY', 'JUNIOR_SCHOOL', 'SENIOR_SCHOOL'],
  } as any, {
    id: 'cmqygd9sn0002zez9nso0o6qk',
    name: 'Wanjiru Kamau',
  });

  const summary = await getSchoolLevelActivationSummary(tenantId);
  expect(summary.isPrimary === true, 'Primary activation is detected');
  expect(summary.isJuniorSchool === true, 'Junior School activation is detected');
  expect(summary.isSeniorSchool === true, 'Senior School activation is detected');
  expect(summary.shouldShowSubjectSelectionTools === true, 'Subject selection tools are enabled when Junior/Senior School is active');
  expect(summary.shouldShowPathwayTools === true, 'Pathway tools are enabled when Senior School is active');
  expect(summary.isMixedSchool === true, 'Mixed school status is detected');

  await updateSchoolProfile(tenantId, {
    educationLevelsOffered: before.educationLevelsOffered,
  } as any, {
    id: 'cmqygd9sn0002zez9nso0o6qk',
    name: 'Wanjiru Kamau',
  });

  console.log('\n  ✅ School level activation summary green');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
