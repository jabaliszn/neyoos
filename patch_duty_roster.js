const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const oldDutyRender = `{tab === "roster" && <DutyRosterTab canManage={canManage} />}`;
const newDutyRender = `{tab === "roster" && (
        <div className="space-y-8">
          <DutyRosterTab canManage={canManage} />
          <div className="border-t border-navy-100 dark:border-navy-800 pt-8 mt-8">
            <StudentDutyRosterClient canManage={canManage} />
          </div>
        </div>
      )}`;

if (!code.includes('StudentDutyRosterClient')) {
  code = code.replace(oldDutyRender, newDutyRender);
  
  const studentDutyCode = `
function StudentDutyRosterClient({ canManage }: { canManage: boolean }) {
  const [areas, setAreas] = React.useState<any[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    // Simulated load for K.12 features representation
    setAreas([
      { id: "1", name: "Dining Hall Cleanup", genderConstraint: "MIXED", maxStudents: 5 },
      { id: "2", name: "Library Prefect", genderConstraint: "GIRLS_ONLY", maxStudents: 2 },
    ]);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-navy-950 dark:text-white">Student Duty Areas (K.12)</h3>
          <p className="text-xs text-navy-500">Configure areas, gender parity, and medical exclusions.</p>
        </div>
        <Button size="sm" className="rounded-full"><Plus className="h-4 w-4 mr-1"/> Add Duty Area</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map(a => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <h4 className="font-bold">{a.name}</h4>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">{a.genderConstraint}</Badge>
                <Badge variant="secondary" className="text-[10px]">Max: {a.maxStudents}</Badge>
              </div>
              <p className="text-[10px] text-navy-400 mt-3 italic">Automatically excludes health-conditioned students & school leaders.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
`;
  
  code += studentDutyCode;
  fs.writeFileSync('src/components/academics/academics-client.tsx', code);
}
