import fs from "node:fs";
import { GET } from "../src/app/api/learner-journey/route";
import { handleError } from "../src/lib/api/respond";
import { LearnerJourneyError } from "../src/lib/services/learner-journey.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  console.log("Starting J.8 Learning Journey Timeline API test...");

  const route = fs.readFileSync("src/app/api/learner-journey/route.ts", "utf8");
  const respond = fs.readFileSync("src/lib/api/respond.ts", "utf8");

  assert(typeof GET === "function", "learner-journey API exposes GET");
  assert(route.includes("requireUser"), "learner-journey API requires signed-in user");
  assert(route.includes("learnerJourneyQuerySchema.parse"), "learner-journey API validates query params with learnerJourneyQuerySchema");
  assert(route.includes("studentId parameter is required"), "learner-journey API guards missing studentId");
  assert(route.includes("getLearnerJourneyTimeline"), "learner-journey API wires the real backend aggregation service");
  assert(route.includes("mode") && route.includes("source") && route.includes("limit"), "learner-journey API forwards mode/source/limit query controls");

  assert(respond.includes("LearnerJourneyError"), "respond.ts imports/maps LearnerJourneyError");
  assert(handleError(new LearnerJourneyError("FORBIDDEN", "No access")).status === 403, "LearnerJourneyError FORBIDDEN maps to 403");
  assert(handleError(new LearnerJourneyError("NOT_FOUND", "Missing learner")).status === 404, "LearnerJourneyError NOT_FOUND maps to 404");
  assert(handleError(new LearnerJourneyError("INVALID", "Bad query")).status === 422, "LearnerJourneyError INVALID maps to 422");

  console.log("J.8 Chunk 4 Learning Journey Timeline API test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
