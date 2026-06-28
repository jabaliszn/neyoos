const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

// 1. Pass activities to SlotDialog
code = code.replace(
  `          existing={grid.get(\`\${cell.day}|\${cell.period}\`) ?? null}
          subjects={subjects.filter((s) => !s.archived)} staff={staff}`,
  `          existing={grid.get(\`\${cell.day}|\${cell.period}\`) ?? null}
          subjects={subjects.filter((s) => !s.archived)} staff={staff} activities={activities}`
);

// 2. Rewrite SlotDialog
const oldSlotDialogStart = `function SlotDialog({ classId, day, period, existing, subjects, staff, showSaturday, onClose, onDone }: any) {
  const { toast } = useToast();
  const [subId, setSubId] = React.useState(existing?.subjectId ?? "");
  const [teacherId, setStaffId] = React.useState(existing?.teacherId ?? "");
  const [venue, setVenue] = React.useState(existing?.venue ?? "");
  const [isCombined, setIsCombined] = React.useState(existing?.isCombined ?? false);
  const [combinedDetails, setCombinedDetails] = React.useState(existing?.combinedDetails ?? "");
  const [saving, setSaving] = React.useState(false);`;

const newSlotDialogStart = `function SlotDialog({ classId, day, period, existing, subjects, activities, staff, showSaturday, onClose, onDone }: any) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"SUBJECT" | "ACTIVITY">(existing?.slotType === "ACTIVITY" ? "ACTIVITY" : "SUBJECT");
  const [subId, setSubId] = React.useState(existing?.subjectId ?? "");
  const [actId, setActId] = React.useState(existing?.activityCategoryId ?? "");
  const [teacherId, setStaffId] = React.useState(existing?.teacherId ?? "");
  const [venue, setVenue] = React.useState(existing?.venue ?? "");
  const [isCombined, setIsCombined] = React.useState(existing?.isCombined ?? false);
  const [combinedDetails, setCombinedDetails] = React.useState(existing?.combinedDetails ?? "");
  const [saving, setSaving] = React.useState(false);`;

code = code.replace(oldSlotDialogStart, newSlotDialogStart);

// 3. Update save() to pass activityCategoryId
const oldSaveCall = `        body: JSON.stringify({
          action: "set",
          classId, dayOfWeek: day, period,
          subjectId: subId || undefined,
          teacherId: teacherId || undefined,
          venue: venue || undefined,
          isCombined,
          combinedDetails: isCombined ? combinedDetails : undefined,
        }),`;

const newSaveCall = `        body: JSON.stringify({
          action: "set",
          classId, dayOfWeek: day, period,
          slotType: mode,
          subjectId: mode === "SUBJECT" ? (subId || undefined) : undefined,
          activityCategoryId: mode === "ACTIVITY" ? (actId || undefined) : undefined,
          teacherId: teacherId || undefined,
          venue: venue || undefined,
          isCombined: mode === "SUBJECT" ? isCombined : false,
          combinedDetails: mode === "SUBJECT" && isCombined ? combinedDetails : undefined,
        }),`;

code = code.replace(oldSaveCall, newSaveCall);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
