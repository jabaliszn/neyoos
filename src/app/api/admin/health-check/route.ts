/**
 * G.30 — NEYO Health Check API.
 * GET -> application/json. Permission: SUPER_ADMIN.
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/respond";
import { getCompanyHealthCheck } from "@/lib/services/health-check.service";
import { getCurrentUser } from "@/lib/core/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return new Response("Unauthorized", { status: 403 });
    }
    const result = await getCompanyHealthCheck(user);
    return ok({ healthCheck: result });
  } catch (e) {
    return handleError(e);
  }
}
