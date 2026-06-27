import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const source = fs.readFileSync("src/components/assessments/assessment-engine-components.tsx", "utf8");

const exportsNeeded = [
  "AssessmentEngineHero",
  "AssessmentSummaryGrid",
  "AssessmentLoadingState",
  "AssessmentErrorState",
  "AssessmentEmptyState",
  "AssessmentTypeCatalog",
  "AssessmentPlanCard",
  "AssessmentTypeForm",
  "AssessmentPlanForm",
  "AssessmentScoreForm",
  "AssessmentEvidenceCard",
  "AssessmentEvidenceForm",
  "AssessmentSheetTable",
  "AssessmentReleasePanel",
];
for (const name of exportsNeeded) assert(source.includes(`export function ${name}`), `${name} is exported`);

const iconsNeeded = [
  "ClipboardList",
  "ListChecks",
  "FileCheck2",
  "ShieldCheck",
  "UploadCloud",
  "BookOpen",
  "BarChart3",
  "Eye",
  "Lock",
  "CheckCircle2",
  "AlertCircle",
  "Loader2",
  "Plus",
  "Save",
];
for (const icon of iconsNeeded) assert(source.includes(icon), `Lucide icon ${icon} is used/imported`);

assert(source.includes("Flexible Assessment Engine"), "hero identifies the flexible assessment engine");
assert(source.includes("without replacing exams"), "copy states that exams are not replaced");
assert(source.includes("Formal exams, CBC observations and LMS work stay intact"), "copy confirms non-duplication of Exams/CBC/LMS");
assert(source.includes("AssessmentLoadingState"), "loading skeleton state exists");
assert(source.includes("AssessmentErrorState"), "error state exists");
assert(source.includes("AssessmentEmptyState"), "empty state exists");
assert(source.includes("AssessmentPlanCard"), "populated plan card exists");
assert(source.includes("AssessmentSheetTable"), "scoring sheet table exists");
assert(source.includes("AssessmentEvidenceForm"), "evidence form exists");
assert(source.includes("AssessmentReleasePanel"), "release panel exists");
assert(source.includes("Storage Vault encrypted upload"), "evidence copy mentions encrypted Storage Vault path");
assert(source.includes("backdrop-blur"), "Liquid Glass-ready backdrop blur styling is present");
assert(source.includes("rounded-2xl"), "Apple-style rounded surfaces are present");
assert(!source.includes("fetch("), "Chunk 5 UI components do not fetch directly");
assert(!/\bAI\b/.test(source), "component source has no banned product-copy word");

console.log("\nJ.3 Chunk 5 assessment UI components test passed.");
