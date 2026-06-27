import fs from "node:fs";
import { handleError } from "../src/lib/api/respond";
import { AssessmentError } from "../src/lib/services/assessment.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const route = fs.readFileSync("src/app/api/assessments/route.ts", "utf8");
  const respond = fs.readFileSync("src/lib/api/respond.ts", "utf8");
  const validation = fs.readFileSync("src/lib/validations/assessment.ts", "utf8");

  assert(route.includes("export async function GET"), "assessments API exposes GET");
  assert(route.includes("export async function POST"), "assessments API exposes POST");
  assert(route.includes("requireUser"), "assessments API requires signed-in user");
  assert(route.includes("assessmentActionSchema.parse"), "POST validates body with assessmentActionSchema");
  assert(route.includes("assessmentBoard"), "GET calls assessmentBoard");
  assert(route.includes("assessmentSheet"), "GET can return assessmentSheet by planId");

  const actions = [
    "seed_default_types",
    "create_type",
    "update_type",
    "create_plan",
    "update_plan",
    "score_record",
    "update_record",
    "attach_evidence",
    "moderate_record",
    "release_plan",
  ];
  for (const action of actions) {
    assert(route.includes(`case "${action}"`), `assessments API handles ${action}`);
    assert(validation.includes(`z.literal("${action}")`), `assessmentActionSchema includes ${action}`);
  }

  const serviceFunctions = [
    "ensureDefaultAssessmentTypes",
    "createAssessmentType",
    "updateAssessmentType",
    "createAssessmentPlan",
    "updateAssessmentPlan",
    "scoreAssessmentRecord",
    "updateAssessmentRecord",
    "attachAssessmentEvidence",
    "moderateAssessmentRecord",
    "releaseAssessmentPlan",
  ];
  for (const fn of serviceFunctions) assert(route.includes(fn), `assessments API wires ${fn}`);

  assert(respond.includes("AssessmentError"), "respond.ts imports/maps AssessmentError");
  assert(handleError(new AssessmentError("FORBIDDEN", "No access")).status === 403, "AssessmentError FORBIDDEN maps to HTTP 403");
  assert(handleError(new AssessmentError("DUPLICATE", "Duplicate")).status === 409, "AssessmentError DUPLICATE maps to HTTP 409");
  assert(handleError(new AssessmentError("NOT_FOUND", "Missing")).status === 404, "AssessmentError NOT_FOUND maps to HTTP 404");
  assert(handleError(new AssessmentError("STATE", "Wrong state")).status === 409, "AssessmentError STATE maps to HTTP 409");
  assert(handleError(new AssessmentError("INVALID", "Invalid")).status === 422, "AssessmentError INVALID maps to HTTP 422");

  console.log("\nJ.3 Chunk 4 assessment API test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
