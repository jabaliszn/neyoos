/**
 * W.1 — Storage Intelligence Engine (founder-requested 2026-07-06).
 * NEYO Ops — SUPER_ADMIN only.
 * GET  — real config + a live preview of potential savings right now.
 * POST — either save real config (action=config) or trigger a real run
 *        (action=run, real dry-run-by-default, tenantId optional for a
 *        real company-wide sweep).
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/core/session";
import { ok, handleError } from "@/lib/api/respond";
import {
  getStorageOptimizerConfig,
  saveStorageOptimizerConfig,
  previewStorageOptimizer,
  runStorageOptimizer,
  listStorageOptimizerRuns,
} from "@/lib/services/storage-optimizer.service";
import { runStorageOptimizerSchema } from "@/lib/validations/storage-optimizer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("SUPER_ADMIN");
    const [config, preview, runs] = await Promise.all([
      getStorageOptimizerConfig(),
      previewStorageOptimizer(),
      listStorageOptimizerRuns(20),
    ]);
    return ok({ config, preview, runs });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));

    if (body?.action === "config") {
      return ok(await saveStorageOptimizerConfig(body.data, user));
    }

    const input = runStorageOptimizerSchema.parse(body?.data ?? body);
    const result = await runStorageOptimizer({ id: user.id, fullName: user.fullName }, input);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
