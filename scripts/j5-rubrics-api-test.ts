import { GET, POST } from "../src/app/api/rubrics/route";
import { rubricActionSchema } from "../src/lib/validations/rubric";
import { handleError } from "../src/lib/api/respond";
import { RubricError } from "../src/lib/services/rubric.service";

async function main() {
  console.log("Starting J.5 Rubrics & Evidence API & route wiring test...");

  // 1. Verify GET and POST exports exist
  if (typeof GET !== "function" || typeof POST !== "function") {
    throw new Error("API route must export GET and POST functions.");
  }
  console.log("✓ GET and POST route handlers exported correctly");

  // 2. Verify Zod action schema validation covers all actions
  const actions = ["seed_defaults", "create_rubric", "update_rubric", "archive_rubric", "attach_rubric", "score_with_rubric", "attach_evidence_file"];
  for (const action of actions) {
    const fakePayload: any = action === "seed_defaults" ? {} : action === "archive_rubric" ? { id: "fake_id", isArchived: true } : { invalidField: true };
    const res = rubricActionSchema.safeParse({ action, payload: fakePayload });
    // It should match the discriminated union branch (either success for seed/archive or ZodError for fields, but not invalid_union_discriminator)
    if (!res.success && res.error.issues.some((i) => i.code === "invalid_union_discriminator")) {
      throw new Error(`Action ${action} not registered in rubricActionSchema.`);
    }
  }
  console.log("✓ all 7 POST actions registered and mapped in rubricActionSchema");

  // 3. Verify RubricError HTTP response mapping in respond.ts
  const notFoundErr = new RubricError("NOT_FOUND", "Rubric not found.");
  const resNotFound = handleError(notFoundErr);
  if (resNotFound.status !== 404) throw new Error("NOT_FOUND should map to 404");
  console.log("✓ RubricError NOT_FOUND maps to HTTP 404");

  const duplicateErr = new RubricError("DUPLICATE", "Rubric name already exists.");
  const resDuplicate = handleError(duplicateErr);
  if (resDuplicate.status !== 409) throw new Error("DUPLICATE should map to 409");
  console.log("✓ RubricError DUPLICATE maps to HTTP 409");

  const forbiddenErr = new RubricError("FORBIDDEN", "Unauthorized.");
  const resForbidden = handleError(forbiddenErr);
  if (resForbidden.status !== 403) throw new Error("FORBIDDEN should map to 403");
  console.log("✓ RubricError FORBIDDEN maps to HTTP 403");

  const invalidErr = new RubricError("INVALID", "Invalid rubric level.");
  const resInvalid = handleError(invalidErr);
  if (resInvalid.status !== 422) throw new Error("INVALID should map to 422");
  console.log("✓ RubricError INVALID maps to HTTP 422");

  console.log("J.5 Chunk 4 Rubrics & Evidence API test passed.");
}

main();
