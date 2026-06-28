import fs from "node:fs";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 Learning Journey Timeline UX hardening test...");

  const cardSource = fs.readFileSync("src/components/learner-journey/learner-journey-card.tsx", "utf8");
  const componentsSource = fs.readFileSync("src/components/learner-journey/learner-journey-components.tsx", "utf8");

  assert(cardSource.includes("const [loading, setLoading] = React.useState(true)"), "connected card distinguishes first-load state");
  assert(cardSource.includes("const [refreshing, setRefreshing] = React.useState(false)"), "connected card supports non-blocking refresh state");
  assert(cardSource.includes("const [lastLoadedAt, setLastLoadedAt] = React.useState<string | null>(null)"), "connected card tracks last refresh time");
  assert(cardSource.includes("soft: !!timeline"), "source changes use soft refresh when prior timeline exists");
  assert(cardSource.includes("disabled={refreshing}"), "source filters disable during refresh to protect UX state");

  assert(componentsSource.includes("export function LearnerJourneyModeNotice"), "mode notice component export exists");
  assert(componentsSource.includes("export function LearnerJourneyRefreshToolbar"), "refresh toolbar component export exists");
  assert(componentsSource.includes("Family-safe learner journey"), "parent-safe mode notice copy exists");
  assert(componentsSource.includes("Internal school milestones may appear here for staff review. Confidential counseling notes still stay outside this timeline."), "staff-mode privacy notice exists");
  assert(componentsSource.includes("Refreshing learner journey...") && componentsSource.includes("Last refreshed"), "refresh toolbar exposes refresh feedback copy");

  assert(!/\bAI\b/.test(cardSource + componentsSource), "UX hardening keeps Bundi copy law intact");

  console.log("J.8 Chunk 7 Learning Journey Timeline UX test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
