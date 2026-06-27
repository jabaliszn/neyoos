import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const source = fs.readFileSync("src/components/competencies/competency-framework-components.tsx", "utf8");

const exportsNeeded = [
  "CompetencyFrameworkHero",
  "CompetencySummaryGrid",
  "CompetencyLoadingState",
  "CompetencyErrorState",
  "CompetencyEmptyState",
  "CompetencyGroupList",
  "CompetencyCard",
  "CompetencyGroupForm",
  "CompetencyForm",
  "CompetencyEvidenceForm",
  "StudentCompetencySummaryCard",
  "CompetencyHeatmapTable",
];
for (const name of exportsNeeded) assert(source.includes(`export function ${name}`), `${name} is exported`);

const iconsNeeded = ["Brain", "Target", "Layers", "Sparkles", "UserRoundCheck", "BarChart3", "Eye", "ShieldCheck", "Loader2", "Save"];
for (const icon of iconsNeeded) assert(source.includes(icon), `Lucide icon ${icon} is used/imported`);

assert(source.includes("Track growth beyond marks"), "hero copy explains growth beyond marks");
assert(source.includes("CBC observations, flexible assessments, LMS work"), "hero copy connects existing modules");
assert(source.includes("CompetencyLoadingState"), "loading state exists");
assert(source.includes("CompetencyErrorState"), "error state exists");
assert(source.includes("CompetencyEmptyState"), "empty state exists");
assert(source.includes("StudentCompetencySummaryCard"), "student summary component exists");
assert(source.includes("CompetencyHeatmapTable"), "heatmap component exists");
assert(source.includes("backdrop-blur"), "Liquid Glass styling is present");
assert(source.includes("rounded-2xl"), "rounded Apple-style surfaces are present");
assert(!source.includes("fetch("), "Chunk 5 UI components do not fetch directly");
assert(!/\bAI\b/.test(source), "component source has no banned product-copy word");

console.log("\nJ.4 Chunk 5 competency UI components test passed.");
