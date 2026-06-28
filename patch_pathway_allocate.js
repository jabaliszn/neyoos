const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-pathway-tab.tsx', 'utf8');

const oldButton = `                {!pref.isAllocated && (
                  <Button variant="outline" size="sm" className="rounded-full text-xs">
                    Allocate to {pref.pathway.code}
                  </Button>
                )}`;

const newButton = `                {!pref.isAllocated && (
                  <Button 
                    variant="outline" size="sm" className="rounded-full text-xs shadow-sm hover:border-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={async () => {
                      const res = await fetch(\`/api/pathways/allocate?studentId=\${studentId}\`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pathwayId: pref.pathwayId, isAllocated: true, isRecommended: true, teacherNotes: "Approved by pathway manager." })
                      });
                      if (res.ok) {
                        toast({ title: "Allocated successfully", tone: "success" });
                        void load();
                      } else {
                        toast({ title: "Failed to allocate", tone: "error" });
                      }
                    }}
                  >
                    Allocate to {pref.pathway.code}
                  </Button>
                )}`;

code = code.replace(oldButton, newButton);
fs.writeFileSync('src/components/students/student-pathway-tab.tsx', code);
