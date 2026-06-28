const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/exams/page.tsx', 'utf8');

if (!code.includes('isCurriculumEngineEnabled')) {
  code = code.replace(
    'import { AdvancedAnalyticsClient } from "@/components/exams/advanced-analytics-client";',
    'import { AdvancedAnalyticsClient } from "@/components/exams/advanced-analytics-client";\nimport { isCurriculumEngineEnabled } from "@/lib/services/launch-control.service";'
  );

  code = code.replace(
    'export default async function ExamsPage() {',
    'export default async function ExamsPage() {\n  const isCurriculumEngineEnabledFlag = await isCurriculumEngineEnabled();'
  );

  const oldTabList = `<TabsList className="mb-4 inline-flex h-9 items-center justify-center rounded-lg bg-navy-100 p-1 text-navy-500 dark:bg-navy-900">
          <TabsTrigger value="exams">Term Exams</TabsTrigger>
          <TabsTrigger value="grading">Grading Scales</TabsTrigger>
          <TabsTrigger value="analytics">Term Analytics</TabsTrigger>
          <TabsTrigger value="advanced">Systemic Insights</TabsTrigger>
          <TabsTrigger value="materials">Materials Log</TabsTrigger>
        </TabsList>`;
  
  const newTabList = `<TabsList className="mb-4 inline-flex h-9 items-center justify-center rounded-lg bg-navy-100 p-1 text-navy-500 dark:bg-navy-900">
          <TabsTrigger value="exams">Term Exams</TabsTrigger>
          <TabsTrigger value="grading">Grading Scales</TabsTrigger>
          <TabsTrigger value="analytics">Term Analytics</TabsTrigger>
          {isCurriculumEngineEnabledFlag && <TabsTrigger value="advanced">Systemic Insights</TabsTrigger>}
          <TabsTrigger value="materials">Materials Log</TabsTrigger>
        </TabsList>`;

  code = code.replace(oldTabList, newTabList);
  fs.writeFileSync('src/app/(app)/exams/page.tsx', code);
}
