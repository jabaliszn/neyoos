const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/portal/page.tsx', 'utf8');

if (!code.includes('isCurriculumEngineEnabled')) {
  code = code.replace(
    'import { ParentPortalClient } from "@/components/portal/parent-portal-client";',
    'import { ParentPortalClient } from "@/components/portal/parent-portal-client";\nimport { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";'
  );

  code = code.replace(
    'export default async function PortalPage() {',
    'export default async function PortalPage() {\n  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();'
  );

  code = code.replace(
    '<ParentPortalClient />',
    '<ParentPortalClient isCurriculumEngineEnabled={isCurriculumEngineEnabledFlag} />'
  );

  fs.writeFileSync('src/app/(app)/portal/page.tsx', code);
}
