import { GET, POST } from "../src/app/api/portfolio/route";
import { portfolioActionSchema } from "../src/lib/validations/portfolio";
import { handleError } from "../src/lib/api/respond";
import { PortfolioError } from "../src/lib/services/portfolio.service";

async function main() {
  console.log("Starting J.7 Student Portfolio System API & route wiring test...");

  // 1. Verify GET and POST exports exist
  if (typeof GET !== "function" || typeof POST !== "function") {
    throw new Error("API route must export GET and POST functions.");
  }
  console.log("✓ GET and POST route handlers exported correctly");

  // 2. Verify Zod action schema validation covers all actions
  const actions = ["submit_item", "update_item", "approve_item", "reject_item", "delete_item"];
  for (const action of actions) {
    const fakePayload: any =
      action === "delete_item"
        ? { id: "fake_id" }
        : action === "approve_item" || action === "reject_item"
          ? { itemId: "fake_id", status: action === "approve_item" ? "APPROVED" : "REJECTED", visibleToParents: true }
          : { invalidField: true };
    const res = portfolioActionSchema.safeParse({ action, payload: fakePayload });
    if (!res.success && res.error.issues.some((i) => i.code === "invalid_union_discriminator")) {
      throw new Error(`Action ${action} not registered in portfolioActionSchema.`);
    }
  }
  console.log("✓ all POST actions registered and mapped in portfolioActionSchema");

  // 3. Verify PortfolioError HTTP response mapping in respond.ts
  const notFoundErr = new PortfolioError("NOT_FOUND", "Portfolio item not found.");
  const resNotFound = handleError(notFoundErr);
  if (resNotFound.status !== 404) throw new Error("NOT_FOUND should map to 404");
  console.log("✓ PortfolioError NOT_FOUND maps to HTTP 404");

  const forbiddenErr = new PortfolioError("FORBIDDEN", "Unauthorized.");
  const resForbidden = handleError(forbiddenErr);
  if (resForbidden.status !== 403) throw new Error("FORBIDDEN should map to 403");
  console.log("✓ PortfolioError FORBIDDEN maps to HTTP 403");

  const invalidErr = new PortfolioError("INVALID", "Invalid item.");
  const resInvalid = handleError(invalidErr);
  if (resInvalid.status !== 422) throw new Error("INVALID should map to 422");
  console.log("✓ PortfolioError INVALID maps to HTTP 422");

  const tooLargeErr = new PortfolioError("TOO_LARGE", "File too large.");
  const resTooLarge = handleError(tooLargeErr);
  if (resTooLarge.status !== 413) throw new Error("TOO_LARGE should map to 413");
  console.log("✓ PortfolioError TOO_LARGE maps to HTTP 413");

  console.log("J.7 Chunk 4 Student Portfolio System API test passed.");
}

main();
