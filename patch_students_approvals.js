const fs = require('fs');
let code = fs.readFileSync('src/components/students/students-client.tsx', 'utf8');

// I'll add a "Pending Approvals" button and a dialog.
const oldHeader = `<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-4">`;

const newHeader = `<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-4">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setApprovalsOpen(true)}>
              Pending Approvals
            </Button>
          )}`;

if (!code.includes('Pending Approvals')) {
  code = code.replace(oldHeader, newHeader);
  code = code.replace('const [error, setError] = React.useState(false);', 'const [error, setError] = React.useState(false);\n  const [approvalsOpen, setApprovalsOpen] = React.useState(false);');

  const approvalsDialog = `
function ApprovalsDialog({ onClose }: any) {
  const [reqs, setReqs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students/approvals");
      const json = await res.json();
      if (json.ok) setReqs(json.data);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function act(id: string, status: string) {
    const res = await fetch(\`/api/students/approvals?id=\${id}\`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) { toast({ title: "Done", tone: "success" }); load(); }
    else toast({ title: "Failed", tone: "error" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-navy-100 bg-white p-6 shadow-pop text-left dark:bg-navy-950 dark:border-navy-800" onClick={(e)=>e.stopPropagation()}>
        <div className="mb-4 flex justify-between items-center border-b border-navy-50 pb-2 dark:border-navy-800">
          <h3 className="font-bold">Pending Student Approvals</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {loading ? <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></div> : 
         reqs.length === 0 ? <p className="text-sm italic text-navy-500">No pending approvals.</p> :
         <div className="space-y-3 max-h-[60vh] overflow-y-auto">
           {reqs.map((r: any) => (
             <div key={r.id} className="p-3 bg-navy-50 dark:bg-navy-900 rounded-xl flex justify-between items-center">
               <div>
                 <p className="font-bold text-sm">{r.student.firstName} {r.student.lastName} ({r.student.admissionNo})</p>
                 <p className="text-xs text-navy-600">Type: {r.requestType} | Req By: {r.requestedByName}</p>
                 {r.documentLabel && <p className="text-xs font-semibold text-blue-600">{r.documentLabel}</p>}
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline" className="text-red-500" onClick={() => act(r.id, "REJECTED")}>Reject</Button>
                 <Button size="sm" onClick={() => act(r.id, "APPROVED")}>Approve</Button>
               </div>
             </div>
           ))}
         </div>
        }
      </div>
    </div>
  );
}`;
  code += approvalsDialog;

  code = code.replace(
    '{dialog && <CreateStudentDialog',
    '{approvalsOpen && <ApprovalsDialog onClose={() => setApprovalsOpen(false)} />}\n      {dialog && <CreateStudentDialog'
  );

  fs.writeFileSync('src/components/students/students-client.tsx', code);
}
