import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const studentProfile = readFileSync(join(process.cwd(), "src/components/students/student-profile-client.tsx"), "utf8");
  const learning = readFileSync(join(process.cwd(), "src/components/learning-videos/learning-videos-client.tsx"), "utf8");

  assert(globals.includes("I.36") && globals.includes("min-width: 1024px") && globals.includes("font-size: 16.5px"), "desktop readability scale is applied without changing phone scale");
  assert(studentProfile.includes("max-h-[min(92dvh,46rem)]") && studentProfile.includes("sticky top-0") && studentProfile.includes("sticky bottom-0"), "Add Guardian modal has full-height scrollable panel with sticky header/footer");
  assert(studentProfile.includes("sm:grid-cols-2") && !studentProfile.includes("grid grid-cols-2 gap-3"), "Add Guardian fields are single-column on phone and two-column on larger screens");

  assert(learning.includes("Search results & saved videos") && !learning.includes("Videos shown in class</CardTitle></CardHeader><CardContent>{shown.length"), "Learning video search results are no longer forced to share half the page with shown-in-class panel");
  assert(learning.includes("Videos shown in class ({shown.length})") && learning.includes("shownOpen"), "Videos shown in class is a compact button that opens a preview dialog");
  assert(learning.includes("IDEAS") && learning.includes("Choose a learning search idea"), "Learning videos screen shows recommended search ideas instead of an empty state");
  assert(!/download/i.test(learning), "Learning videos UI does not expose video download actions");

  console.log("\nI.36 Readability / Layout Fixes test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
