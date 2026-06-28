const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-profile-client.tsx', 'utf8');

if (!code.includes('StudentPathwayTab')) {
  code = code.replace(
    'import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";',
    `import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";\nimport { StudentPathwayTab } from "@/components/students/student-pathway-tab";`
  );

  const newSection = `
          {/* Senior School Pathway */}
          <StudentPathwayTab studentId={s.id} />
          
          <LearnerJourneyCard studentId={s.id} mode="staff" />`;

  code = code.replace(
    '<LearnerJourneyCard studentId={s.id} mode="staff" />',
    newSection
  );
}

fs.writeFileSync('src/components/students/student-profile-client.tsx', code);
