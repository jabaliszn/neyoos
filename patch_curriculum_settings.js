const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('CurriculumVersionManagerClient')) {
  code = code.replace(
    'import { ReportBuilderClient } from "./report-builder";',
    'import { ReportBuilderClient } from "./report-builder";\nimport { CurriculumVersionManagerClient } from "./curriculum-version-manager";'
  );

  code = code.replace(
    '{ key: "reports" as const, label: "Report Builder", icon: FileText },',
    `{ key: "reports" as const, label: "Report Builder", icon: FileText },
    { key: "curriculum-versions" as const, label: "Curriculum Versions", icon: Sliders },`
  );

  code = code.replace(
    '{tab === "reports" && <ReportBuilderClient canManage={canManage} />}',
    `{tab === "reports" && <ReportBuilderClient canManage={canManage} />}\n      {tab === "curriculum-versions" && <CurriculumVersionManagerClient canManage={canManage} />}`
  );
}

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
