import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 Learning Journey Timeline frontend wiring test...");

  const cardSource = fs.readFileSync("src/components/learner-journey/learner-journey-card.tsx", "utf8");
  const studentProfileSource = fs.readFileSync("src/components/students/student-profile-client.tsx", "utf8");
  const parentPortalSource = fs.readFileSync("src/components/portal/parent-portal-client.tsx", "utf8");

  assert(cardSource.includes('fetch(`/api/learner-journey?${params.toString()}`'), "connected learner journey card fetches the real learner-journey API");
  assert(cardSource.includes('mode, limit: String(limit)'), "connected learner journey card forwards real mode and limit values");
  assert(cardSource.includes('params.set("source", nextSource)'), "connected learner journey card supports source filter reloads");

  const states = [
    "LearnerJourneyLoadingState",
    "LearnerJourneyErrorState",
    "LearnerJourneyEmptyState",
    "LearnerJourneyTimelineList",
  ];
  for (const state of states) {
    assert(cardSource.includes(state), `connected learner journey card uses ${state}`);
  }

  assert(cardSource.includes("LearnerJourneyHero"), "connected learner journey card uses hero component");
  assert(cardSource.includes("LearnerJourneySummaryGrid"), "connected learner journey card uses summary grid component");
  assert(cardSource.includes("LearnerJourneySourceFilterBar"), "connected learner journey card uses source filter bar component");

  assert(studentProfileSource.includes("LearnerJourneyCard") && studentProfileSource.includes('mode="staff"'), "student profile mounts the staff learner journey card");
  assert(parentPortalSource.includes("LearnerJourneyCard") && parentPortalSource.includes('mode="parent"'), "parent portal mounts the parent-safe learner journey card");

  assert(!/\bAI\b/.test(cardSource + studentProfileSource + parentPortalSource), "Bundi copy law respected across learner journey frontend wiring");

  console.log("J.8 Chunk 6 Learning Journey Timeline frontend wiring test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
