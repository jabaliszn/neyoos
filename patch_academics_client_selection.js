const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('SubjectSelectionManager')) {
  code = code.replace(
    'import { PathwayManagerClient } from "./pathway-manager";',
    'import { PathwayManagerClient } from "./pathway-manager";\nimport { SubjectSelectionManager } from "./subject-selection-manager";'
  );

  code = code.replace(
    '{ key: "pathways" as const, label: "Senior Pathways", icon: Sparkles }',
    `{ key: "pathways" as const, label: "Senior Pathways", icon: Sparkles },
      { key: "subject-selection" as const, label: "Subject Selection", icon: BookOpen }`
  );

  code = code.replace(
    '{tab === "pathways" && <PathwayManagerClient subjects={[]} />}',
    `{tab === "pathways" && <PathwayManagerClient subjects={[]} />}\n      {tab === "subject-selection" && <SubjectSelectionManager subjects={subjects} />}`
  );

  fs.writeFileSync('src/components/academics/academics-client.tsx', code);
}
