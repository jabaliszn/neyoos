const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

// The UI hardcoded the number of periods to exactly 8 everywhere, causing the "when I press 10 it put only 8" bug.
// Let's replace `[1, 2, 3, 4, 5, 6, 7, 8]` with a dynamic array based on config.periodsPerDay

// 1. In TimetablePrintBundleView (line 890 area)
code = code.replace(
  '{[1, 2, 3, 4, 5, 6, 7, 8].flatMap((p) => {',
  '{Array.from({ length: group.config.periodsPerDay || 8 }, (_, i) => i + 1).flatMap((p) => {'
);

// 2. In TimetableTab render (mobile & desktop views, lines 1111, 1138, 1162)
// Since we don't know the exact lines, we'll replace the hardcoded arrays carefully.
// The config variable is named `config`.

code = code.replace(
  /\{\[1, 2, 3, 4, 5, 6, 7, 8\]\.flatMap\(\(p\) => \{/g,
  '{Array.from({ length: config?.periodsPerDay || 8 }, (_, i) => i + 1).flatMap((p) => {'
);

code = code.replace(
  /\{\[1, 2, 3, 4, 5, 6, 7, 8\]\.map\(\(p\) => \(/g,
  '{Array.from({ length: config?.periodsPerDay || 8 }, (_, i) => i + 1).map((p) => ('
);

// Also the NonLessonMergedRow needs updating
const oldNonLessonMerge = `function nonLessonRowsForPeriod(period: number, config: any) {
  const rows = [];
  if (period === config?.shortBreakStart) rows.push({ key: \`sb-\${period}\`, label: "Short Break", minutes: config.shortBreakMins, tone: "break" as const, timeRange: "" });
  if (period === config?.longBreakStart) rows.push({ key: \`lb-\${period}\`, label: "Long Break", minutes: config.longBreakMins, tone: "break" as const, timeRange: "" });
  if (period === config?.lunchStart) rows.push({ key: \`lu-\${period}\`, label: "Lunch Break", minutes: config.lunchMins, tone: "lunch" as const, timeRange: "" });
  return rows;
}`;

const newNonLessonMerge = `function nonLessonRowsForPeriod(period: number, config: any) {
  const rows = [];
  if (period === config?.shortBreakStart) rows.push({ key: \`sb-\${period}\`, label: "Short Break", minutes: config.shortBreakMins, tone: "break" as const, timeRange: "" });
  if (period === config?.shortBreak2Start) rows.push({ key: \`sb2-\${period}\`, label: "Short Break 2", minutes: config.shortBreak2Mins, tone: "break" as const, timeRange: "" });
  if (period === config?.longBreakStart) rows.push({ key: \`lb-\${period}\`, label: "Long Break", minutes: config.longBreakMins, tone: "break" as const, timeRange: "" });
  if (period === config?.lunchStart) rows.push({ key: \`lu-\${period}\`, label: "Lunch Break", minutes: config.lunchMins, tone: "lunch" as const, timeRange: "" });
  return rows;
}`;

code = code.replace(oldNonLessonMerge, newNonLessonMerge);

// Update Saturday Bulk Picker (which had hardcoded 8)
code = code.replace(
  `{[1, 2, 3, 4, 5, 6, 7, 8].map((p) => {`,
  `{Array.from({ length: 12 }, (_, i) => i + 1).map((p) => {`
);

fs.writeFileSync('src/components/academics/academics-client.tsx', code);
