const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

// I need to split the large ChildView.
// This is risky with raw string replacement because ChildView is huge.
// Let's use a regex to capture everything from `function ChildView` to the end of its block, or just insert the condition right inside the return.

const oldReturn = `  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> My children
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={data.child.name} photoUrl={data.child.photoUrl} size={56} />
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{data.child.name}</h2>
            <p className="text-xs text-navy-400">{data.child.className ?? "—"} · <span className="font-mono">{data.child.admissionNo}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={\`/portfolio?studentId=\${data.child.id}\`}>
            <Button size="sm" variant="secondary"><FolderOpen className="h-3.5 w-3.5" /> Portfolio</Button>
          </a>
          {data.child.classId && <ClassChatButton classId={data.child.classId} />}
        </div>
      </div>`;

const newReturn = `
  const modules = [
    { id: "fees", label: "Fees", icon: Wallet, color: "text-green-600", bg: "bg-green-100" },
    { id: "results", label: "Results", icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-100" },
    { id: "attendance", label: "Attendance", icon: CalendarDays, color: "text-amber-600", bg: "bg-amber-100" },
    { id: "pickup", label: "Pickup Safety", icon: ShieldCheck, color: "text-purple-600", bg: "bg-purple-100" },
    { id: "homework", label: "Homework", icon: FileText, color: "text-rose-600", bg: "bg-rose-100" },
    { id: "quizzes", label: "Quizzes", icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-100" },
    { id: "classnotes", label: "Class Notes", icon: BookOpen, color: "text-cyan-600", bg: "bg-cyan-100" },
    { id: "uniform", label: "Uniform Shop", icon: ShoppingBag, color: "text-pink-600", bg: "bg-pink-100" },
    { id: "library", label: "Library", icon: Book, color: "text-orange-600", bg: "bg-orange-100" }
  ];

  return (
    <div className="space-y-4">
      <button onClick={activeModule ? () => setActiveModule(null) : onBack} className="inline-flex items-center gap-1 text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-400">
        <ArrowLeft className="h-4 w-4" /> {activeModule ? "Back to modules" : "My children"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={data.child.name} photoUrl={data.child.photoUrl} size={56} />
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-50">{data.child.name}</h2>
            <p className="text-xs text-navy-400">{data.child.className ?? "—"} · <span className="font-mono">{data.child.admissionNo}</span></p>
          </div>
        </div>
        {!activeModule && (
          <div className="flex flex-wrap items-center gap-2">
            <a href={\`/portfolio?studentId=\${data.child.id}\`}>
              <Button size="sm" variant="secondary"><FolderOpen className="h-3.5 w-3.5" /> Portfolio</Button>
            </a>
            {data.child.classId && <ClassChatButton classId={data.child.classId} />}
          </div>
        )}
      </div>

      {!activeModule && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-6">
          {modules.map(m => {
            const Icon = m.icon;
            return (
              <button 
                key={m.id} 
                onClick={() => setActiveModule(m.id)}
                className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border border-navy-100 bg-white hover:shadow-card hover:-translate-y-0.5 transition-all dark:bg-navy-950 dark:border-navy-800"
              >
                <div className={\`h-10 w-10 flex items-center justify-center rounded-full mb-2 \${m.bg} dark:bg-opacity-20\`}>
                  <Icon className={\`h-5 w-5 \${m.color}\`} />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-navy-950 dark:text-white text-center leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
      
      {/* Fees Module */}
      <div className={activeModule === "fees" ? "block" : "hidden"}>
`;

code = code.replace(oldReturn, newReturn);

// Now wrap existing cards.
code = code.replace(
  '{/* results */}',
  `</div>\n      {/* Results Module */}\n      <div className={activeModule === "results" ? "block" : "hidden"}>\n      {/* results */}`
);

code = code.replace(
  '<Card className="border-t-4 border-t-amber-500">',
  `</div>\n      {/* Attendance Module */}\n      <div className={activeModule === "attendance" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-amber-500">`
);

code = code.replace(
  '<PickupSafetyCard',
  `</div>\n      {/* Pickup Safety Module */}\n      <div className={activeModule === "pickup" ? "block" : "hidden"}>\n      <PickupSafetyCard`
);

code = code.replace(
  '<Card className="border-t-4 border-t-rose-500">',
  `</div>\n      {/* Homework Module */}\n      <div className={activeModule === "homework" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-rose-500">`
);

code = code.replace(
  '<Card className="border-t-4 border-t-indigo-500">',
  `</div>\n      {/* Quizzes Module */}\n      <div className={activeModule === "quizzes" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-indigo-500">`
);

code = code.replace(
  '<Card className="border-t-4 border-t-cyan-500">',
  `</div>\n      {/* Classnotes Module */}\n      <div className={activeModule === "classnotes" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-cyan-500">`
);

code = code.replace(
  '<Card className="border-t-4 border-t-pink-500">',
  `</div>\n      {/* Uniform Shop Module */}\n      <div className={activeModule === "uniform" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-pink-500">`
);

code = code.replace(
  '<Card className="border-t-4 border-t-orange-500">',
  `</div>\n      {/* Library Module */}\n      <div className={activeModule === "library" ? "block" : "hidden"}>\n      <Card className="border-t-4 border-t-orange-500">`
);

// We need to close the last div right before `payInvoice &&`
code = code.replace(
  '{payInvoice && <PayDialog',
  `</div>\n\n      {payInvoice && <PayDialog`
);

// Add missing imports
if (!code.includes('BookOpen, ShoppingBag, Book')) {
  code = code.replace(
    'ArrowRightLeft, Download, Undo2, Loader2, X,',
    'ArrowRightLeft, Download, Undo2, Loader2, X, BookOpen, ShoppingBag, Book,'
  );
}

fs.writeFileSync('src/components/portal/parent-portal-client.tsx', code);
