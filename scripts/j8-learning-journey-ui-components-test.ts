import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 Learning Journey Timeline UI components test...");

  const file = fs.readFileSync("src/components/learner-journey/learner-journey-components.tsx", "utf8");

  const exports = [
    "LearnerJourneyHero",
    "LearnerJourneySummaryGrid",
    "LearnerJourneyLoadingState",
    "LearnerJourneyErrorState",
    "LearnerJourneyEmptyState",
    "LearnerJourneySourceFilterBar",
    "LearnerJourneyEntryCard",
    "LearnerJourneyTimelineList",
  ];
  for (const name of exports) {
    assert(file.includes(`export function ${name}`), `component export ${name} exists`);
  }

  const icons = [
    "GraduationCap",
    "ClipboardList",
    "CalendarDays",
    "ShieldCheck",
    "Brain",
    "Award",
    "FolderOpen",
    "FileCheck2",
    "Layers",
  ];
  for (const icon of icons) {
    assert(file.includes(icon), `uses Lucide icon ${icon}`);
  }

  assert(file.includes("Education OS · Learning Journey"), "hero copy identifies Learning Journey correctly");
  assert(file.includes("released exam results, flexible assessments, attendance, competencies, skills, discipline milestones and approved portfolio evidence"), "hero copy explains the real connected learner journey sources");
  assert(file.includes("Only approved and family-safe milestones appear here"), "empty state explains parent-safe visibility rules");
  assert(file.includes("released exam results, attendance, competencies, portfolio milestones"), "filter bar copy explains real source filtering");
  assert(file.includes("Family safe") && file.includes("School staff only"), "entry cards expose visibility states");
  assert(file.includes("Verified") && file.includes("Pending review") && file.includes("Recorded"), "entry cards expose verification states");

  assert(file.includes("backdrop-blur") && file.includes("rounded-2xl"), "components follow Liquid Glass styling conventions");
  assert(!file.includes("fetch(") && !file.includes("axios") && !file.includes("/api/"), "UI components do not fetch directly");
  assert(!/\bAI\b/.test(file), "UI copy avoids the banned word AI");

  console.log("J.8 Chunk 5 Learning Journey Timeline UI components test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
