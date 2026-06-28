const fs = require('fs');
let code = fs.readFileSync('src/app/(app)/exams/page.tsx', 'utf8');

if (!code.includes('ExamPrintClient')) {
  code = code.replace(
    'import { ExamAnalyticsClient } from "@/components/exams/exam-analytics-client";',
    'import { ExamAnalyticsClient } from "@/components/exams/exam-analytics-client";\nimport { ExamPrintClient } from "@/components/exams/exam-print-client";'
  );

  const oldTabList = `{tab === "exams" && <ExamsTab canManage={canManage} />}`;
  const newTabList = `{tab === "exams" && (\n          <div className="space-y-4">\n            <ExamsTab canManage={canManage} />\n            <div className="mt-8 pt-8 border-t border-navy-100 dark:border-navy-800"><ExamPrintClient /></div>\n          </div>\n        )}`;

  code = code.replace(oldTabList, newTabList);
  fs.writeFileSync('src/app/(app)/exams/page.tsx', code);
}
