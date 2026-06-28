const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('ComputationDashboardClient')) {
  code = code.replace(
    'import { PathwayManagerClient } from "./pathway-manager";',
    'import { PathwayManagerClient } from "./pathway-manager";\nimport { ComputationDashboardClient } from "./computation-dashboard";'
  );

  code = code.replace(
    '{ key: "reports" as const, label: "Report Builder", icon: FileText },',
    `{ key: "computation" as const, label: "Grading Engine", icon: Calculator },\n      { key: "reports" as const, label: "Report Builder", icon: FileText },`
  );

  code = code.replace(
    '{tab === "reports" && <ReportBuilderClient canManage={canManage} />}',
    `{tab === "computation" && <ComputationDashboardClient canManage={canManage} />}\n      {tab === "reports" && <ReportBuilderClient canManage={canManage} />}`
  );

  fs.writeFileSync('src/components/academics/academics-client.tsx', code);
}
