const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const getActivityStyleStr = `
function getActivityStyle(color: string | null | undefined, isBandW: boolean) {
  if (isBandW) return "border border-navy-300 bg-white text-navy-950 font-bold dark:bg-navy-950 dark:text-white";
  switch (color) {
    case "blue": return "bg-blue-500/10 border border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30";
    case "green": return "bg-green-500/10 border border-green-200 text-green-800 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30";
    case "purple": return "bg-purple-500/10 border border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30";
    case "amber": return "bg-amber-500/10 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30";
    case "rose": return "bg-rose-500/10 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30";
    default: return "bg-gray-500/10 border border-gray-200 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800/50";
  }
}
`;

const oldCard = `function TimetableSlotCard({ slot, isBandW, fontSize, canManage, onClick, teacherFirst = false }: { slot?: Slot; isBandW: boolean; fontSize: number; canManage?: boolean; onClick?: () => void; teacherFirst?: boolean }) {
  const cellBgClass = getSubjectStyle(slot?.subjectCode || "FREE", isBandW);
  return (
    <button
      disabled={!canManage}
      onClick={onClick}
      className={\`w-full min-h-[52px] rounded-xl p-2 text-left transition relative flex flex-col justify-between \${cellBgClass}\`}
      style={{ fontSize: \`\${fontSize}px\` }}
    >
      {slot ? (
        <>
          <div className="flex items-center justify-between w-full gap-1">
            <span className="font-extrabold tracking-wide leading-tight">
              {getSubjectAbbreviation(slot.subjectName, slot.subjectCode)}
            </span>
            {slot.isCombined && (
              <span className="text-[7.5px] uppercase font-black bg-green-500/25 px-1 py-0.5 rounded">Combined</span>
            )}
          </div>
          <div className="flex flex-col mt-1 text-navy-500 dark:text-navy-400 font-medium" style={{ fontSize: \`\${Math.max(8, fontSize - 2)}px\` }}>
            <span>{teacherFirst ? slot.className || slot.teacherName : slot.teacherName}</span>
            {slot.venue && <span className="font-bold text-green-700 dark:text-green-300">@ {slot.venue}</span>}
            {slot.isCombined && slot.combinedDetails && <span className="text-[8px] italic truncate max-w-[100px]">{slot.combinedDetails}</span>}
          </div>
        </>
      ) : (
        <span className="text-[10px] text-navy-300 dark:text-navy-600 font-medium italic">Unassigned</span>
      )}
    </button>
  );
}`;

const newCard = getActivityStyleStr + `
function TimetableSlotCard({ slot, isBandW, fontSize, canManage, onClick, teacherFirst = false }: { slot?: Slot; isBandW: boolean; fontSize: number; canManage?: boolean; onClick?: () => void; teacherFirst?: boolean }) {
  const isActivity = slot?.slotType === "ACTIVITY";
  const cellBgClass = isActivity 
    ? getActivityStyle(slot?.activityCategoryColor, isBandW)
    : getSubjectStyle(slot?.subjectCode || "FREE", isBandW);
    
  return (
    <button
      disabled={!canManage}
      onClick={onClick}
      className={\`w-full min-h-[52px] rounded-xl p-2 text-left transition relative flex flex-col justify-between \${cellBgClass}\`}
      style={{ fontSize: \`\${fontSize}px\` }}
    >
      {slot ? (
        <>
          <div className="flex items-center justify-between w-full gap-1">
            <span className="font-extrabold tracking-wide leading-tight line-clamp-2">
              {isActivity ? slot.activityCategoryName : getSubjectAbbreviation(slot.subjectName || "", slot.subjectCode || "")}
            </span>
            {slot.isCombined && !isActivity && (
              <span className="text-[7.5px] uppercase font-black bg-green-500/25 px-1 py-0.5 rounded">Combined</span>
            )}
            {isActivity && (
              <span className="text-[7px] uppercase font-black bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">Activity</span>
            )}
          </div>
          <div className="flex flex-col mt-1 text-navy-600 dark:text-navy-300 font-medium" style={{ fontSize: \`\${Math.max(8, fontSize - 2)}px\` }}>
            <span>{teacherFirst ? slot.className || slot.teacherName : slot.teacherName}</span>
            {slot.venue && <span className="font-bold text-green-700 dark:text-green-300">@ {slot.venue}</span>}
            {slot.isCombined && slot.combinedDetails && <span className="text-[8px] italic truncate max-w-[100px]">{slot.combinedDetails}</span>}
          </div>
        </>
      ) : (
        <span className="text-[10px] text-navy-300 dark:text-navy-600 font-medium italic">Unassigned</span>
      )}
    </button>
  );
}`;

code = code.replace(oldCard, newCard);
fs.writeFileSync('src/components/academics/academics-client.tsx', code);
