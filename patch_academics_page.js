const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/academics/page.tsx', 'utf8');

if (!code.includes('isCurriculumEngineEnabled')) {
  code = code.replace(
    'import { AcademicsClient } from "@/components/academics/academics-client";',
    'import { AcademicsClient } from "@/components/academics/academics-client";\nimport { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";'
  );

  code = code.replace(
    'const isScopedHod = !canAppointHod && (user.role === "HOD" || user.secondaryRole === "HOD");',
    `const isScopedHod = !canAppointHod && (user.role === "HOD" || user.secondaryRole === "HOD");\n  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();`
  );

  code = code.replace(
    '<AcademicsClient canManage={canManage} canAppointHod={canAppointHod} isScopedHod={isScopedHod} />',
    '<AcademicsClient canManage={canManage} canAppointHod={canAppointHod} isScopedHod={isScopedHod} isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />'
  );
  
  fs.writeFileSync('src/app/(app)/academics/page.tsx', code);
}
