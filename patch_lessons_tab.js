const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const oldRows = `                  {plans.map((p) => (
                    <TR key={p.id}>
                      <TD className="w-[120px] font-medium">{new Date(p.date).toLocaleDateString("en-KE")}</TD>
                      <TD><span className="font-bold">{p.className}</span> <span className="text-navy-500">· {p.subjectName}</span></TD>
                      <TD>{p.topic}</TD>
                      <TD className="text-navy-500">{p.teacherName}</TD>
                      <TD>
                        <Badge variant={p.status === "PLANNED" ? "outline" : p.status === "TAUGHT" ? "secondary" : "destructive"}>{p.status}</Badge>
                      </TD>
                    </TR>
                  ))}`;

const newRows = `                  {plans.map((p: any) => (
                    <TR key={p.id}>
                      <TD className="w-[120px] font-medium">{new Date(p.date).toLocaleDateString("en-KE")}</TD>
                      <TD><span className="font-bold">{p.className}</span> <span className="text-navy-500">· {p.subjectName}</span></TD>
                      <TD>
                        <div>{p.topic}</div>
                        {(p.strand || p.competency) && (
                          <div className="flex items-center gap-2 mt-1">
                            {p.strand && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">Strand: {p.strand.name}</Badge>}
                            {p.competency && <Badge variant="outline" className="text-[9px] border-purple-200 text-purple-700 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-300">Comp: {p.competency.name}</Badge>}
                          </div>
                        )}
                      </TD>
                      <TD className="text-navy-500">{p.teacherName}</TD>
                      <TD>
                        <Badge variant={p.status === "PLANNED" ? "outline" : p.status === "TAUGHT" ? "secondary" : "destructive"}>{p.status}</Badge>
                      </TD>
                    </TR>
                  ))}`;

code = code.replace(oldRows, newRows);
fs.writeFileSync('src/components/academics/academics-client.tsx', code);
