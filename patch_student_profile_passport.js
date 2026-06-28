const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-profile-client.tsx', 'utf8');

if (!code.includes('StudentIdentityTab')) {
  code = code.replace(
    'import { StudentPathwayTab } from "@/components/students/student-pathway-tab";',
    'import { StudentPathwayTab } from "@/components/students/student-pathway-tab";\nimport { StudentIdentityTab } from "@/components/students/student-identity-tab";'
  );

  const tabsNav = `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
        <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
        <button onClick={() => setTab("identity")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "identity" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Identity & Transfer</button>
        <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance Ledger</button>
      </div>`;

  code = code.replace(
    `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
        <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
        <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance Ledger</button>
      </div>`,
    tabsNav
  );

  code = code.replace(
    `{tab === "finance" && <div className="p-4 sm:p-6"><FinanceTab studentId={s.id} /></div>}`,
    `{tab === "identity" && <div className="p-4 sm:p-6"><StudentIdentityTab studentId={s.id} /></div>}\n      {tab === "finance" && <div className="p-4 sm:p-6"><FinanceTab studentId={s.id} /></div>}`
  );
}

fs.writeFileSync('src/components/students/student-profile-client.tsx', code);
