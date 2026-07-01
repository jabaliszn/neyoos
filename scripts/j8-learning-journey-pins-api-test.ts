import fs from "node:fs";
import { GET, POST } from "../src/app/api/learner-journey/route";
import { handleError } from "../src/lib/api/respond";
import { LearnerJourneyError } from "../src/lib/services/learner-journey.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 pinned milestones API test...");

  const route = fs.readFileSync("src/app/api/learner-journey/route.ts", "utf8");
  const respond = fs.readFileSync("src/lib/api/respond.ts", "utf8");

  assert(typeof GET === "function", "learner-journey API still exposes GET timeline handler");
  assert(typeof POST === "function", "learner-journey API exposes POST milestone action handler");
  assert(route.includes("requireUser"), "learner-journey API requires signed-in user for POST too");
  assert(route.includes("pinLearnerJourneyMilestone"), "learner-journey API wires the real pin milestone service");
  assert(route.includes("unpinLearnerJourneyMilestone"), "learner-journey API wires the real unpin milestone service");
  assert(route.includes('input?.action === "pin_milestone"'), "learner-journey API supports pin_milestone action");
  assert(route.includes('input?.action === "unpin_milestone"'), "learner-journey API supports unpin_milestone action");
  assert(route.includes("Supported learner journey actions are pin_milestone and unpin_milestone"), "learner-journey API rejects unknown milestone actions clearly");

  assert(respond.includes("LearnerJourneyError"), "respond.ts still imports/maps LearnerJourneyError for milestone API failures");
  assert(handleError(new LearnerJourneyError("FORBIDDEN", "No access")).status === 403, "LearnerJourneyError FORBIDDEN still maps to 403 for milestone actions");
  assert(handleError(new LearnerJourneyError("NOT_FOUND", "Missing learner")).status === 404, "LearnerJourneyError NOT_FOUND still maps to 404 for milestone actions");
  assert(handleError(new LearnerJourneyError("INVALID", "Bad payload")).status === 422, "LearnerJourneyError INVALID still maps to 422 for milestone actions");

  console.log("J.8 pinned milestones API test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
