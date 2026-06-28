const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/students/[id]/page.tsx', 'utf8');

if (!code.includes('isCurriculumEngineEnabled')) {
  code = code.replace(
    'import { StudentProfileClient } from "@/components/students/student-profile-client";',
    'import { StudentProfileClient } from "@/components/students/student-profile-client";\nimport { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";'
  );

  code = code.replace(
    'const canEdit = can(user.role, "student.edit");',
    'const canEdit = can(user.role, "student.edit");\n  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();'
  );

  code = code.replace(
    '<StudentProfileClient initial={initial} canEdit={canEdit} />',
    '<StudentProfileClient initial={initial} canEdit={canEdit} isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />'
  );

  fs.writeFileSync('src/app/(app)/students/[id]/page.tsx', code);
}
