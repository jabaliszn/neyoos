const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-profile-client.tsx', 'utf8');

if (!code.includes('StudentTalentTab')) {
  code = code.replace(
    'import { StudentPathwayTab } from "@/components/students/student-pathway-tab";',
    'import { StudentPathwayTab } from "@/components/students/student-pathway-tab";\nimport { StudentTalentTab } from "@/components/students/student-talent-tab";'
  );

  const newSection = `
          {/* Talent Tracking */}
          <StudentTalentTab studentId={s.id} />
          
          {/* Senior School Pathway */}`;

  code = code.replace(
    '{/* Senior School Pathway */}',
    newSection
  );
}

fs.writeFileSync('src/components/students/student-profile-client.tsx', code);
