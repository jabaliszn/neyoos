import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — deep health check (A.13). Public; consumed by uptime
 * monitors (Better Stack). Returns 200 when operational, 503 when down.
 */
export async function GET() {
  const result = await runHealthChecks();
  const httpStatus = result.status === "down" ? 503 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
