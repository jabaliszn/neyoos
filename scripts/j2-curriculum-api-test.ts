import fs from "node:fs";
import { handleError } from "../src/lib/api/respond";
import { CurriculumError } from "../src/lib/services/curriculum.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const route = fs.readFileSync("src/app/api/curriculum/route.ts", "utf8");
  const respond = fs.readFileSync("src/lib/api/respond.ts", "utf8");

  assert(route.includes('export async function GET'), "curriculum API exposes GET");
  assert(route.includes('export async function POST'), "curriculum API exposes POST");
  assert(route.includes('requireUser'), "curriculum API requires a signed-in session");
  assert(route.includes('curriculumActionSchema.parse'), "POST validates body with curriculumActionSchema");
  assert(route.includes('curriculumBoard'), "GET calls curriculumBoard service");

  const actions = [
    "create_curriculum",
    "update_curriculum",
    "create_level",
    "update_level",
    "create_grade_band",
    "update_grade_band",
    "create_learning_area",
    "update_learning_area",
    "map_existing_records",
    "run_migration_assistant",
  ];
  for (const action of actions) {
    assert(route.includes(`case "${action}"`), `curriculum API handles ${action}`);
  }

  const serviceFunctions = [
    "createCurriculum",
    "updateCurriculum",
    "createEducationLevel",
    "updateEducationLevel",
    "createGradeBand",
    "updateGradeBand",
    "createLearningArea",
    "updateLearningArea",
    "mapExistingCurriculumRecords",
    "runCurriculumMigrationAssistant",
  ];
  for (const fn of serviceFunctions) {
    assert(route.includes(fn), `curriculum API wires ${fn}`);
  }

  assert(respond.includes('CurriculumError'), "respond.ts imports/maps CurriculumError");

  const forbidden = handleError(new CurriculumError("FORBIDDEN", "No curriculum access."));
  assert(forbidden.status === 403, "CurriculumError FORBIDDEN maps to HTTP 403");
  const duplicate = handleError(new CurriculumError("DUPLICATE", "Duplicate curriculum."));
  assert(duplicate.status === 409, "CurriculumError DUPLICATE maps to HTTP 409");
  const notFound = handleError(new CurriculumError("NOT_FOUND", "Missing curriculum."));
  assert(notFound.status === 404, "CurriculumError NOT_FOUND maps to HTTP 404");
  const invalid = handleError(new CurriculumError("INVALID", "Invalid mapping."));
  assert(invalid.status === 422, "CurriculumError INVALID maps to HTTP 422");

  console.log("\nJ.2 Chunk 4 curriculum API test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
