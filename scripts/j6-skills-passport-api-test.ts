import { GET, POST } from "../src/app/api/skills-passport/route";
import { skillsPassportActionSchema } from "../src/lib/validations/skills-passport";
import { handleError } from "../src/lib/api/respond";
import { SkillsPassportError } from "../src/lib/services/skills-passport.service";

async function main() {
  console.log("Starting J.6 Skills Passport API & route wiring test...");

  // 1. Verify GET and POST exports exist
  if (typeof GET !== "function" || typeof POST !== "function") {
    throw new Error("API route must export GET and POST functions.");
  }
  console.log("✓ GET and POST route handlers exported correctly");

  // 2. Verify Zod action schema validation covers all actions
  const actions = ["record_skill_rating", "remove_skill_rating"];
  for (const action of actions) {
    const fakePayload: any = action === "remove_skill_rating" ? { id: "fake_id" } : { invalidField: true };
    const res = skillsPassportActionSchema.safeParse({ action, payload: fakePayload });
    if (!res.success && res.error.issues.some((i) => i.code === "invalid_union_discriminator")) {
      throw new Error(`Action ${action} not registered in skillsPassportActionSchema.`);
    }
  }
  console.log("✓ all POST actions registered and mapped in skillsPassportActionSchema");

  // 3. Verify SkillsPassportError HTTP response mapping in respond.ts
  const notFoundErr = new SkillsPassportError("NOT_FOUND", "Student not found.");
  const resNotFound = handleError(notFoundErr);
  if (resNotFound.status !== 404) throw new Error("NOT_FOUND should map to 404");
  console.log("✓ SkillsPassportError NOT_FOUND maps to HTTP 404");

  const forbiddenErr = new SkillsPassportError("FORBIDDEN", "Unauthorized.");
  const resForbidden = handleError(forbiddenErr);
  if (resForbidden.status !== 403) throw new Error("FORBIDDEN should map to 403");
  console.log("✓ SkillsPassportError FORBIDDEN maps to HTTP 403");

  const invalidErr = new SkillsPassportError("INVALID", "Invalid parameter.");
  const resInvalid = handleError(invalidErr);
  if (resInvalid.status !== 422) throw new Error("INVALID should map to 422");
  console.log("✓ SkillsPassportError INVALID maps to HTTP 422");

  console.log("J.6 Chunk 4 Skills Passport API test passed.");
}

main();
