const fs = require('fs');
let code = fs.readFileSync('src/components/portal/parent-portal-client.tsx', 'utf8');

const oldDocs = `<Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-600" /> Documents</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.documents.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-950">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-navy-400" />
                  <div>
                    <p className="text-sm font-bold">{d.label}</p>
                    <p className="text-[10px] text-navy-400">Added {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full"><Download className="h-4 w-4 text-navy-600"/></Button>
                </a>
              </div>
            ))}
            {data.documents.length === 0 && <p className="text-xs italic text-navy-500">No documents on file.</p>}
          </div>
        </CardContent>
      </Card>`;

const newDocs = `<Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-600" /> Documents & KNEC Uploads</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={async () => {
             const url = prompt("Enter uploaded file URL (Simulated for K.10 / K.16):");
             if (!url) return;
             const label = prompt("Document Name (e.g. Birth Certificate, KNEC Registration):") || "Uploaded Document";
             
             const res = await fetch("/api/students/approvals", {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ studentId: id, requestType: "DOCUMENT_UPLOAD", fileUrl: url, documentLabel: label })
             });
             if (res.ok) {
               toast({ title: "Upload submitted to Class Teacher for approval.", tone: "success" });
             } else {
               toast({ title: "Upload failed", tone: "error" });
             }
          }}>
             Upload Document
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.documents.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-950">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-navy-400" />
                  <div>
                    <p className="text-sm font-bold">{d.label}</p>
                    <p className="text-[10px] text-navy-400">Added {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full"><Download className="h-4 w-4 text-navy-600"/></Button>
                </a>
              </div>
            ))}
            {data.documents.length === 0 && <p className="text-xs italic text-navy-500">No documents on file.</p>}
          </div>
        </CardContent>
      </Card>`;

if (!code.includes('Upload Document') && code.includes('<CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-600" /> Documents')) {
  code = code.replace(oldDocs, newDocs);
  fs.writeFileSync('src/components/portal/parent-portal-client.tsx', code);
} else if (!code.includes('Upload Document')) {
  // if we can't find oldDocs exactly, let's just do a regex replace
  code = code.replace(
    /<CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-600" \/> Documents<\/CardTitle><\/CardHeader>/g,
    `<CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-amber-600" /> Documents</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={async () => {
             const url = prompt("Enter uploaded file URL (Simulated for K.10 / K.16):");
             if (!url) return;
             const label = prompt("Document Name (e.g. Birth Certificate, KNEC Registration):") || "Uploaded Document";
             
             const res = await fetch("/api/students/approvals", {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ studentId: id, requestType: "DOCUMENT_UPLOAD", fileUrl: url, documentLabel: label })
             });
             if (res.ok) {
               toast({ title: "Upload submitted to Class Teacher for approval.", tone: "success" });
             } else {
               toast({ title: "Upload failed", tone: "error" });
             }
          }}>
             Upload Document
          </Button>
        </CardHeader>`
  );
  fs.writeFileSync('src/components/portal/parent-portal-client.tsx', code);
}
