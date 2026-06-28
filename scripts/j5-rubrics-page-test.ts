import * as fs from "node:fs";
import * as path from "node:path";

function main() {
  console.log("Starting J.5 Rubrics & Evidence page & wiring test...");
  const pagePath = path.join(process.cwd(), "src", "app", "(app)", "settings", "rubrics", "page.tsx");
  const clientPath = path.join(process.cwd(), "src", "components", "rubrics", "rubric-engine-client.tsx");
  const navPath = path.join(process.cwd(), "src", "lib", "core", "navigation.ts");
  const assessmentClientPath = path.join(process.cwd(), "src", "components", "assessments", "assessment-engine-client.tsx");

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  const clientContent = fs.readFileSync(clientPath, "utf-8");
  const navContent = fs.readFileSync(navPath, "utf-8");
  const assessmentClientContent = fs.readFileSync(assessmentClientPath, "utf-8");

  // 1. Verify page server guards and effective permissions
  if (!pageContent.includes("requirePageUser()") || !pageContent.includes("effectivePermissionsForUser(")) {
    throw new Error("Page missing requirePageUser or effectivePermissionsForUser server guards.");
  }
  if (!pageContent.includes("academics.view") || !pageContent.includes("tenant.manage_settings")) {
    throw new Error("Page missing correct academic/settings permissions check.");
  }
  console.log("✓ rubrics page server guards and effective permissions verified");

  // 2. Verify client real API fetch and post wiring
  if (!clientContent.includes('fetch("/api/rubrics"') || !clientContent.includes('method: "POST"')) {
    throw new Error("Client missing real fetch or POST wiring to /api/rubrics.");
  }
  const actions = ["seed_defaults", "create_rubric", "update_rubric", "archive_rubric"];
  for (const act of actions) {
    if (!clientContent.includes(act)) {
      throw new Error(`Client missing real post action: ${act}`);
    }
  }
  console.log("✓ client real API fetch/post wiring verified perfectly");

  // 3. Verify all 4 mandatory UX states
  if (!clientContent.includes("RubricLoadingState") || !clientContent.includes("RubricErrorState") || !clientContent.includes("RubricEmptyState") || !clientContent.includes("RubricCard")) {
    throw new Error("Client missing one of the mandatory 4 UX states (Loading, Error, Empty, Populated).");
  }
  console.log("✓ all 4 mandatory UX states verified in connected client");

  // 4. Verify sidebar link
  if (!navContent.includes("/settings/rubrics") || !navContent.includes("ListChecks")) {
    throw new Error("Navigation missing Rubrics link or ListChecks icon.");
  }
  console.log("✓ sidebar navigation includes Rubrics link with ListChecks icon");

  // 5. Verify teacher scoring panel wiring in flexible assessment client
  if (!assessmentClientContent.includes("TeacherRubricScoringPanel") || !assessmentClientContent.includes("RubricScoreWrapper")) {
    throw new Error("Assessment client missing TeacherRubricScoringPanel wiring.");
  }
  console.log("✓ teacher scoring panel wiring in flexible assessment client verified");

  // 6. Verify Bundi copy law (no banned word)
  if (/\bAI\b/.test(pageContent) || /\bAI\b/.test(clientContent)) {
    throw new Error("Bundi Copy Law violation: found banned word 'AI'.");
  }
  console.log("✓ Bundi Copy Law enforced: zero occurrences of banned word 'AI'");

  console.log("J.5 Chunk 6 Rubrics & Evidence page test passed.");
}

main();
