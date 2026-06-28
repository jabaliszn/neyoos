const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

if (!code.includes('ParentGrowthTab')) {
  code = code.replace(
    'import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";',
    `import { LearnerJourneyCard } from "@/components/learner-journey/learner-journey-card";\nimport { ParentGrowthTab } from "./parent-growth-tab";`
  );

  const tabsNav = `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
          <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
          <button onClick={() => setTab("growth")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "growth" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Growth & Goals</button>
          <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance</button>
        </div>`;

  code = code.replace(
    `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
          <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
          <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance</button>
        </div>`,
    tabsNav
  );

  const tabContent = `{tab === "overview" && (
          <div className="space-y-6">`;

  code = code.replace(
    `{tab === "overview" && (
          <div className="space-y-6">`,
    `{tab === "growth" && <div className="p-4 sm:p-6"><ParentGrowthTab studentId={id} /></div>}
        {tab === "overview" && (
          <div className="space-y-6">`
  );
}

fs.writeFileSync('src/components/portal/parent-portal-client.tsx', code);
