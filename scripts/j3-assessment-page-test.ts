import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const page = fs.readFileSync("src/app/(app)/assessments/page.tsx", "utf8");
const client = fs.readFileSync("src/components/assessments/assessment-engine-client.tsx", "utf8");
const nav = fs.readFileSync("src/lib/core/navigation.ts", "utf8");

assert(page.includes("AssessmentsPage"), "assessments page exists");
assert(page.includes("requirePageUser"), "page requires signed-in user");
assert(page.includes("effectivePermissionsForUser"), "page uses effective permissions including secondary roles");
assert(page.includes("academics.view") && page.includes("exam.view"), "page allows academics/exam readers");
assert(page.includes("redirect(\"/forbidden\")"), "page redirects unauthorized users to forbidden");
assert(page.includes("<AssessmentEngineClient />"), "page mounts connected assessment client");
assert(page.includes("keeping Exams, CBC and LMS intact"), "page copy preserves non-duplication rule");

assert(client.includes('fetch("/api/assessments"'), "client fetches real assessment board API");
assert(client.includes('`/api/assessments?planId='), "client fetches real assessment sheet API");
assert(client.includes('method: "POST"'), "client posts real assessment mutations");
assert(client.includes("seed_default_types"), "client can seed default assessment types");
assert(client.includes("create_type"), "client can create/update assessment type actions");
assert(client.includes("create_plan"), "client can create assessment plans");
assert(client.includes("score_record"), "client can score records");
assert(client.includes("attach_evidence"), "client can attach evidence");
assert(client.includes("release_plan"), "client can release plans");
assert(client.includes("AssessmentLoadingState"), "client renders loading state");
assert(client.includes("AssessmentErrorState"), "client renders error state");
assert(client.includes("AssessmentEmptyState"), "client renders empty state");
assert(client.includes("AssessmentPlanCard"), "client renders populated plan cards");
assert(client.includes("AssessmentSheetTable"), "client renders scoring sheet table");
assert(!/\bAI\b/.test(page + client), "page/client contain no banned product-copy word");

assert(nav.includes('label: "Assessments"') && nav.includes('href: "/assessments"'), "sidebar navigation includes Assessments link");

console.log("\nJ.3 Chunk 6 assessment page test passed.");
