const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-profile-client.tsx', 'utf8');

code = code.replace(
  'export function StudentProfileClient({ initial, canEdit }: { initial: Student; canEdit: boolean }) {',
  'export function StudentProfileClient({ initial, canEdit, isCurriculumEngineEnabled = false }: { initial: Student; canEdit: boolean; isCurriculumEngineEnabled?: boolean }) {'
);

const oldNav = `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
        <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
        <button onClick={() => setTab("identity")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "identity" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Identity & Transfer</button>
        <button onClick={() => setTab("service")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "service" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Community Service</button>
        <button onClick={() => setTab("career")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "career" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Career Discovery</button>
        <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance Ledger</button>
      </div>`;

const newNav = `<div className="flex space-x-1 border-b border-navy-100 overflow-x-auto px-4 sm:px-6 hide-scrollbar dark:border-navy-800">
        <button onClick={() => setTab("overview")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "overview" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Overview</button>
        {isCurriculumEngineEnabled && <button onClick={() => setTab("identity")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "identity" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Identity & Transfer</button>}
        {isCurriculumEngineEnabled && <button onClick={() => setTab("service")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "service" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Community Service</button>}
        {isCurriculumEngineEnabled && <button onClick={() => setTab("career")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "career" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Career Discovery</button>}
        <button onClick={() => setTab("finance")} className={\`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap \${tab === "finance" ? "border-green-600 text-green-700 dark:border-green-500 dark:text-green-400" : "border-transparent text-navy-500 hover:text-navy-950 dark:hover:text-white"}\`}>Finance Ledger</button>
      </div>`;

code = code.replace(oldNav, newNav);
fs.writeFileSync('src/components/students/student-profile-client.tsx', code);
