const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

code = code.replace(
  'export function AcademicsClient({ canManage, canAppointHod, isScopedHod }: { canManage: boolean; canAppointHod: boolean; isScopedHod: boolean }) {',
  'export function AcademicsClient({ canManage, canAppointHod, isScopedHod, isCurriculumEngineEnabled = false }: { canManage: boolean; canAppointHod: boolean; isScopedHod: boolean; isCurriculumEngineEnabled?: boolean }) {'
);

const oldTabs = `  const tabs = [
    { key: "subjects" as const, label: "Subjects", icon: BookOpen },
    { key: "departments" as const, label: "Departments", icon: Building2 },
    { key: "cocurricular" as const, label: "Co-curricular", icon: Trophy },
    { key: "terms" as const, label: "Terms", icon: CalendarRange },
    { key: "timetable" as const, label: "Timetable", icon: Grid3X3 },
    { key: "lessons" as const, label: "Lesson plans", icon: NotebookPen },
    { key: "reports" as const, label: "Report Builder", icon: FileText },
    { key: "curriculum-versions" as const, label: "Curriculum Versions", icon: Sliders },
    { key: "generator" as const, label: "Timetable Generator", icon: Sparkles },
    { key: "roster" as const, label: "Duty Roster", icon: CalendarRange },
  ];`;

const newTabs = `  const tabs = [
    { key: "subjects" as const, label: "Subjects", icon: BookOpen },
    { key: "departments" as const, label: "Departments", icon: Building2 },
    { key: "cocurricular" as const, label: "Co-curricular", icon: Trophy },
    { key: "terms" as const, label: "Terms", icon: CalendarRange },
    { key: "timetable" as const, label: "Timetable", icon: Grid3X3 },
    { key: "lessons" as const, label: "Lesson plans", icon: NotebookPen },
    ...(isCurriculumEngineEnabled ? [
      { key: "reports" as const, label: "Report Builder", icon: FileText },
      { key: "curriculum-versions" as const, label: "Curriculum Versions", icon: Sliders },
      { key: "pathways" as const, label: "Senior Pathways", icon: Sparkles }
    ] : []),
    { key: "generator" as const, label: "Timetable Generator", icon: Sparkles },
    { key: "roster" as const, label: "Duty Roster", icon: CalendarRange },
  ];`;

code = code.replace(oldTabs, newTabs);

if (!code.includes('PathwayManagerClient')) {
    code = code.replace('import { CurriculumVersionManagerClient } from "./curriculum-version-manager";', 'import { CurriculumVersionManagerClient } from "./curriculum-version-manager";\nimport { PathwayManagerClient } from "./pathway-manager";');
}

code = code.replace(
  `{tab === "curriculum-versions" && <CurriculumVersionManagerClient canManage={canManage} />}`,
  `{tab === "curriculum-versions" && <CurriculumVersionManagerClient canManage={canManage} />}\n      {tab === "pathways" && <PathwayManagerClient subjects={[]} />}` // simplified subjects passing since we fetch it anyway inside PathwayManagerClient mostly or we can pass subjects
);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
