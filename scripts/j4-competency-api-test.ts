import fs from "node:fs";
import { handleError } from "../src/lib/api/respond";
import { CompetencyError } from "../src/lib/services/competency.service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const route = fs.readFileSync("src/app/api/competencies/route.ts", "utf8");
  const respond = fs.readFileSync("src/lib/api/respond.ts", "utf8");
  const validation = fs.readFileSync("src/lib/validations/competency.ts", "utf8");

  assert(route.includes("export async function GET"), "competencies API exposes GET");
  assert(route.includes("export async function POST"), "competencies API exposes POST");
  assert(route.includes("requireUser"), "competencies API requires signed-in user");
  assert(route.includes("competencyActionSchema.parse"), "POST validates with competencyActionSchema");
  assert(route.includes("competencyBoard"), "GET returns competencyBoard");
  assert(route.includes("studentCompetencySummary"), "GET supports student summary");
  assert(route.includes("competencyHeatmap"), "GET supports heatmap");

  const actions = ["seed_defaults", "create_group", "update_group", "create_competency", "update_competency", "record_evidence", "update_evidence", "approve_evidence"];
  for (const action of actions) {
    assert(route.includes(`case "${action}"`), `competencies API handles ${action}`);
    assert(validation.includes(`z.literal("${action}")`), `competencyActionSchema includes ${action}`);
  }

  const serviceFunctions = ["ensureDefaultCompetencyFramework", "createCompetencyGroup", "updateCompetencyGroup", "createCompetency", "updateCompetency", "recordCompetencyEvidence", "updateCompetencyEvidence", "approveCompetencyEvidence"];
  for (const fn of serviceFunctions) assert(route.includes(fn), `competencies API wires ${fn}`);

  assert(respond.includes("CompetencyError"), "respond.ts imports/maps CompetencyError");
  assert(handleError(new CompetencyError("FORBIDDEN", "No access")).status === 403, "CompetencyError FORBIDDEN maps to 403");
  assert(handleError(new CompetencyError("DUPLICATE", "Duplicate")).status === 409, "CompetencyError DUPLICATE maps to 409");
  assert(handleError(new CompetencyError("NOT_FOUND", "Missing")).status === 404, "CompetencyError NOT_FOUND maps to 404");
  assert(handleError(new CompetencyError("INVALID", "Invalid")).status === 422, "CompetencyError INVALID maps to 422");

  console.log("\nJ.4 Chunk 4 competency API test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
