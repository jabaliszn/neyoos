/**
 * PART J.7 — Student Portfolio System API.
 *
 * GET /api/portfolio?studentId=...
 *   Returns row-scoped learner portfolio timeline.
 * GET /api/portfolio?studentId=...&export=1
 *   Returns portable approved-portfolio export pack.
 * POST /api/portfolio
 *   Runs one validated portfolio action.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/core/session";
import { ok, fail, handleError } from "@/lib/api/respond";
import { portfolioActionSchema } from "@/lib/validations/portfolio";
import {
  approvePortfolioItem,
  deletePortfolioItem,
  exportPortfolioPack,
  getPortfolioTimeline,
  rejectPortfolioItem,
  submitPortfolioItem,
  updatePortfolioItem,
} from "@/lib/services/portfolio.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const studentId = req.nextUrl.searchParams.get("studentId");
    if (!studentId) return fail("INVALID", "studentId parameter is required.", 422);

    if (req.nextUrl.searchParams.get("export") === "1") {
      return ok({ pack: await exportPortfolioPack(user, studentId) });
    }

    return ok({ timeline: await getPortfolioTimeline(user, studentId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = portfolioActionSchema.parse(await req.json());
    switch (input.action) {
      case "submit_item":
        return ok({ result: await submitPortfolioItem(user, input.payload) });
      case "update_item":
        return ok({ result: await updatePortfolioItem(user, input.payload) });
      case "approve_item":
        return ok({ result: await approvePortfolioItem(user, input.payload) });
      case "reject_item":
        return ok({ result: await rejectPortfolioItem(user, input.payload) });
      case "delete_item":
        return ok({ result: await deletePortfolioItem(user, input.payload.id) });
      default: {
        const _exhaustive: never = input;
        return ok({ result: _exhaustive });
      }
    }
  } catch (error) {
    return handleError(error);
  }
}
