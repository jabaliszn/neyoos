/**
 * L.7 draft-resume coverage check.
 * Verifies the Smart Timetable UI contains local draft-resume protection for
 * unfinished teacher time-off and combination setup.
 */
import fs from "fs";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

const file = fs.readFileSync("src/components/academics/academics-client.tsx", "utf8");

check("Draft key exists for smart timetable", file.includes('neyo-smart-timetable-draft-v1'));
check("Uses localStorage to persist unfinished setup", file.includes('localStorage.setItem(DRAFT_KEY'));
check("Restores saved draft from localStorage", file.includes('localStorage.getItem(DRAFT_KEY'));
check("Can clear saved draft explicitly", file.includes('clearDraft(') && file.includes('localStorage.removeItem(DRAFT_KEY)'));
check("UI tells user draft will be restored", file.includes('Draft resume protection'));
check("Draft restore badge is visible", file.includes('Draft restored'));

console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail === 0) console.log("  ✅ L.7 draft-resume coverage green");
if (fail > 0) process.exit(1);
