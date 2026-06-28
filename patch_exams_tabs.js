const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/exams/page.tsx', 'utf8');

if (code.includes('import { ExamAnalyticsClient }') && !code.includes('AdvancedAnalyticsClient')) {
  code = code.replace(
    'import { ExamAnalyticsClient } from "@/components/exams/exam-analytics-client";',
    'import { ExamAnalyticsClient } from "@/components/exams/exam-analytics-client";\nimport { AdvancedAnalyticsClient } from "@/components/exams/advanced-analytics-client";'
  );

  code = code.replace(
    '{tab === "analytics" && <ExamAnalyticsClient />}',
    '{tab === "analytics" && <ExamAnalyticsClient />}\n        {tab === "advanced" && <AdvancedAnalyticsClient />}'
  );

  code = code.replace(
    '          <TabsTrigger value="analytics">Analytics</TabsTrigger>',
    '          <TabsTrigger value="analytics">Term Analytics</TabsTrigger>\n          <TabsTrigger value="advanced">Systemic Insights</TabsTrigger>'
  );
}
fs.writeFileSync('src/app/(app)/exams/page.tsx', code);
