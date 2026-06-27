import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const source = fs.readFileSync("src/components/curriculum/curriculum-engine-components.tsx", "utf8");

const exportsNeeded = [
  "CurriculumEngineHero",
  "CurriculumSummaryGrid",
  "CurriculumLoadingState",
  "CurriculumErrorState",
  "CurriculumEmptyState",
  "CurriculumStructureCard",
  "CurriculumMappingPanel",
  "CurriculumForm",
  "EducationLevelForm",
  "GradeBandForm",
  "LearningAreaForm",
  "CurriculumMappingReviewTable",
];
for (const name of exportsNeeded) {
  assert(source.includes(`export function ${name}`), `${name} is exported`);
}

const iconsNeeded = [
  "Compass",
  "School",
  "GraduationCap",
  "Layers",
  "BookOpen",
  "CalendarDays",
  "ShieldCheck",
  "Link2",
  "Settings2",
  "Save",
  "Loader2",
];
for (const icon of iconsNeeded) {
  assert(source.includes(icon), `Lucide icon ${icon} is used/imported`);
}

assert(source.includes("Configure curriculum. Do not hardcode curriculum."), "admin-facing Education OS explanation is present");
assert(source.includes("Existing subjects and classes will be mapped"), "empty state explains non-duplicating mapping workflow");
assert(source.includes("CurriculumErrorState"), "error state component exists");
assert(source.includes("CurriculumLoadingState"), "loading skeleton state exists");
assert(source.includes("CurriculumEmptyState"), "empty state component exists");
assert(source.includes("LearningAreaForm"), "learning-area form exists");
assert(source.includes("GradeBandForm"), "grade-band form exists");
assert(source.includes("Year 9"), "custom grade name example is visible");
assert(source.includes("CBC, 8-4-4, Cambridge, custom"), "copy supports multiple curriculum frameworks");
assert(source.includes("backdrop-blur"), "Liquid Glass-ready backdrop blur styling is present");
assert(source.includes("rounded-2xl"), "Apple-style rounded card/input surfaces are present");
assert(!/\bAI\b/.test(source), "component source has no banned product-copy word");
assert(!source.includes("fetch("), "Chunk 5 UI components are reusable and do not fetch directly");

console.log("\nJ.2 Chunk 5 curriculum UI components test passed.");
