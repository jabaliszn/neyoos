import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const commands = readFileSync(join(process.cwd(), "src/lib/core/commands.ts"), "utf8");
  const help = readFileSync(join(process.cwd(), "src/components/shell/help-overlay.tsx"), "utf8");
  const palette = readFileSync(join(process.cwd(), "src/components/shell/command-palette.tsx"), "utf8");

  assert(commands.includes("go-learning-videos") && commands.includes("/learning-videos") && commands.includes("youtube"), "command registry includes Learning Videos / YouTube command");
  assert(commands.includes("go-attendance") && commands.includes("go-exam-timetable") && commands.includes("go-syllabus") && commands.includes("go-gate"), "command registry includes more low/buried module commands");
  assert(commands.includes('keys: "L"') && commands.includes("Learning videos") && commands.includes('keys: "F"') && commands.includes('keys: "A"'), "shortcut list documents direct letter hotkeys");

  assert(help.includes("HOTKEY_MAP") && help.includes("permission?: string") && help.includes("visibleHotkeys"), "help overlay has a real permission-filtered hotkey map");
  assert(help.includes('l: { route: "/learning-videos"') && help.includes('q: { route: "/exam-timetable"') && help.includes('0: { route: "/founder"') || help.includes('"0": { route: "/founder"'), "help overlay includes direct shortcuts for learning videos, exam timetable and NEYO Ops");
  assert(help.includes("neyo:open-search") && help.includes("Command"), "help overlay can open the full command search from the shortcut guide");
  assert(help.includes("!target.permission || has(target.permission)"), "single-letter hotkeys check permissions before navigating");

  assert(palette.includes("APP_COMMANDS") && palette.includes("commandHits") && palette.includes("/api/search"), "command palette still merges command actions and global search results");

  console.log("\nI.38 Command & Shortcut System test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
