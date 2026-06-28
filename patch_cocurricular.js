const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

if (!code.includes('import { TalentManagerClient }')) {
  code = code.replace(
    'import * as React from "react";',
    'import * as React from "react";\nimport { TalentManagerClient } from "./talent-manager";'
  );
  
  const oldCoCurricularTab = `function CoCurricularTab({ canManage, onOpenTimetable }: { canManage: boolean; onOpenTimetable: () => void }) {
  const { toast } = useToast();`;

  const newCoCurricularTab = `function CoCurricularTab({ canManage, onOpenTimetable }: { canManage: boolean; onOpenTimetable: () => void }) {
  return <TalentManagerClient canManage={canManage} />;
}

function OldCoCurricularTab({ canManage, onOpenTimetable }: { canManage: boolean; onOpenTimetable: () => void }) {
  const { toast } = useToast();`;

  code = code.replace(oldCoCurricularTab, newCoCurricularTab);
}
fs.writeFileSync('src/components/academics/academics-client.tsx', code);
