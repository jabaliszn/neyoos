import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const page = fs.readFileSync("src/app/(app)/settings/curriculum/page.tsx", "utf8");
const client = fs.readFileSync("src/components/curriculum/curriculum-engine-client.tsx", "utf8");
const nav = fs.readFileSync("src/lib/core/navigation.ts", "utf8");
const settings = fs.readFileSync("src/app/(app)/settings/page.tsx", "utf8");

assert(page.includes("CurriculumSettingsPage"), "settings curriculum page exists");
assert(page.includes("requirePageUser"), "page requires a signed-in user");
assert(page.includes("effectivePermissionsForUser"), "page uses effective permissions including secondary roles");
assert(page.includes("academics.view") && page.includes("tenant.manage_settings"), "page allows academics/settings readers");
assert(page.includes("redirect(\"/forbidden\")"), "page redirects unauthorized users to forbidden");
assert(page.includes("<CurriculumEngineClient />"), "page mounts connected curriculum client");
assert(page.includes("Configure curriculum versions"), "page has admin-facing explanation copy");

assert(client.includes('fetch("/api/curriculum"'), "client fetches the real curriculum API");
assert(client.includes('method: "POST"'), "client posts real curriculum mutations");
assert(client.includes("CurriculumLoadingState"), "client renders loading state");
assert(client.includes("CurriculumErrorState"), "client renders error state");
assert(client.includes("CurriculumEmptyState"), "client renders empty state");
assert(client.includes("CurriculumStructureCard"), "client renders populated curriculum cards");
assert(client.includes("CurriculumForm"), "client wires curriculum form");
assert(client.includes("EducationLevelForm"), "client wires education level form");
assert(client.includes("GradeBandForm"), "client wires grade band form");
assert(client.includes("LearningAreaForm"), "client wires learning area form");
assert(client.includes("create_curriculum"), "client can create curriculum through API action");
assert(client.includes("update_curriculum"), "client can update curriculum through API action");
assert(client.includes("create_level"), "client can create education levels through API action");
assert(client.includes("create_grade_band"), "client can create grade bands through API action");
assert(client.includes("create_learning_area"), "client can create learning areas through API action");
assert(client.includes("run_migration_assistant"), "client can run the migration assistant through API action");
assert(!/\bAI\b/.test(client + page), "page/client contain no banned product-copy word");

assert(nav.includes('label: "Curriculum"') && nav.includes('href: "/settings/curriculum"'), "sidebar navigation includes Curriculum settings link");
assert(settings.includes('label: "Curriculum"') && settings.includes('href: "/settings/curriculum"'), "settings hub includes Curriculum card");

console.log("\nJ.2 Chunk 6 curriculum page test passed.");
