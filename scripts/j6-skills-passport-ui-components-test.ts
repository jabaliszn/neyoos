import * as fs from "node:fs";
import * as path from "node:path";

function main() {
  console.log("Starting J.6 Skills Passport UI components test...");
  const filePath = path.join(process.cwd(), "src", "components", "skills-passport", "skills-passport-components.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // 1. Verify all required component exports exist
  const exports = [
    "SkillsPassportHero",
    "SkillsPassportSummaryGrid",
    "SkillsPassportLoadingState",
    "SkillsPassportErrorState",
    "SkillsPassportEmptyState",
    "AcademicGrowthList",
    "CompetencyGrowthList",
    "TalentLeadershipCard",
    "SkillRatingForm",
  ];
  for (const exp of exports) {
    if (!content.includes(`export function ${exp}`)) {
      throw new Error(`Missing export for component: ${exp}`);
    }
  }
  console.log("✓ all 9 Skills Passport UI component exports exist perfectly");

  // 2. Verify Lucide icon usage
  const icons = ["Award", "Target", "Sparkles", "Layers", "ShieldCheck", "Star", "CheckCircle2", "AlertCircle", "Loader2", "Plus", "Save", "X", "Archive", "Trash2", "FileText", "GraduationCap", "Download", "Trophy", "Music", "Code", "Dumbbell", "Users", "Brain"];
  for (const icon of icons) {
    if (!content.includes(icon)) {
      throw new Error(`Missing Lucide icon usage: ${icon}`);
    }
  }
  console.log("✓ rich Lucide icon usage verified across components");

  // 3. Verify non-duplication and growth copy
  if (!content.includes("Formal exams, CBC observations and LMS work stay intact.")) {
    throw new Error("Missing non-duplication copy preservation.");
  }
  if (!content.includes("growth beyond marks")) {
    throw new Error("Missing growth beyond marks copy.");
  }
  console.log("✓ non-duplication and growth copy preserved perfectly");

  // 4. Verify Liquid Glass styling
  if (!content.includes("backdrop-blur") || !content.includes("rounded-2xl")) {
    throw new Error("Missing Liquid Glass styling primitives (backdrop-blur, rounded-2xl).");
  }
  console.log("✓ Liquid Glass styling primitives (backdrop-blur, rounded-2xl) verified");

  // 5. Verify no direct fetch()
  if (content.includes("fetch(")) {
    throw new Error("UI components file should be presentational/forms only and must not call fetch() directly.");
  }
  console.log("✓ UI components are cleanly decoupled and contain no direct fetch() calls");

  // 6. Verify Bundi copy law (no banned word)
  // Ensure the exact whole word "AI" is not used in product copy
  if (/\bAI\b/.test(content)) {
    throw new Error("Bundi Copy Law violation: found banned word 'AI'.");
  }
  console.log("✓ Bundi Copy Law enforced: zero occurrences of banned word 'AI'");

  console.log("J.6 Chunk 5 Skills Passport UI components test passed.");
}

main();
