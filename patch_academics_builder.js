const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('ReportBuilderClient')) {
  code = code.replace(
    'import { TalentManagerClient } from "./talent-manager";',
    'import { TalentManagerClient } from "./talent-manager";\nimport { ReportBuilderClient } from "./report-builder";'
  );

  code = code.replace(
    '{ key: "lessons" as const, label: "Lesson plans", icon: NotebookPen },',
    `{ key: "lessons" as const, label: "Lesson plans", icon: NotebookPen },
    { key: "reports" as const, label: "Report Builder", icon: FileText },`
  );

  code = code.replace(
    '{tab === "lessons" && <LessonsTab />}',
    `{tab === "lessons" && <LessonsTab />}\n      {tab === "reports" && <ReportBuilderClient canManage={canManage} />}`
  );
}

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
